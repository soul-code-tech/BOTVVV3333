# smart_trader_with_ui.py
import os
import time
import json
import logging
import threading
from datetime import datetime, timedelta
from collections import defaultdict
import requests
import hmac
import hashlib
import urllib.parse
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template_string, redirect, url_for, session

# Загружаем переменные окружения
load_dotenv()

# ============= НАСТРОЙКИ =============
API_KEY = os.getenv("BINGX_API_KEY")
SECRET_KEY = os.getenv("BINGX_SECRET_KEY")
WEB_PASSWORD = os.getenv("WEB_PASSWORD", "admin")  # Пароль для веб-интерфейса
BASE_URL = "https://open-api.bingx.com"

# Расширенный список пар (50+)
SYMBOLS = [
    "BTC-USDT", "ETH-USDT", "BNB-USDT", "SOL-USDT", "XRP-USDT",
    "DOGE-USDT", "ADA-USDT", "AVAX-USDT", "MATIC-USDT", "DOT-USDT",
    "LINK-USDT", "ATOM-USDT", "UNI-USDT", "APT-USDT", "ARB-USDT",
    "OP-USDT", "NEAR-USDT", "FIL-USDT", "LTC-USDT", "BCH-USDT",
    "ETC-USDT", "INJ-USDT", "RNDR-USDT", "TIA-USDT", "WLD-USDT",
    "SUI-USDT", "SEI-USDT", "AAVE-USDT", "MKR-USDT", "COMP-USDT",
    "YFI-USDT", "SNX-USDT", "CRV-USDT", "GRT-USDT", "AXS-USDT",
    "SAND-USDT", "MANA-USDT", "GALA-USDT", "IMX-USDT", "STX-USDT",
    "FLOW-USDT", "MINA-USDT", "ICP-USDT", "KLAY-USDT", "THETA-USDT",
    "ALGO-USDT", "VET-USDT", "HBAR-USDT", "FTM-USDT", "CELO-USDT",
    "BLUR-USDT", "PEPE-USDT", "BONK-USDT", "JUP-USDT", "ENA-USDT",
    "TAO-USDT", "ONDO-USDT", "STRK-USDT", "ZRO-USDT", "ACT-USDT"
]

CHECK_INTERVAL = 300  # секунд (5 минут)
RISK_PER_TRADE_PCT = 1.0  # Риск на сделку в % от капитала
MAX_DRAWDOWN_PCT = 20.0  # Максимальная просадка для остановки
MAX_ACTIVE_POSITIONS = 5  # Максимум одновременных позиций
TRAILING_STOP_PCT = 2.0   # Трейлинг-стоп в процентах от максимума

# ============= ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =============
app = Flask(__name__)
app.secret_key = os.urandom(24)

# Хранилище для трейлинг-стопов
trailing_stops = {}
active_trades = {}
trade_history = []
balance_log = []
last_total_balance = 0

# ============= ЛОГИРОВАНИЕ =============
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("smart_trader.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============= ФУНКЦИИ API =============
def sign_request(params, secret):
    query_string = urllib.parse.urlencode(params)
    signature = hmac.new(secret.encode(), query_string.encode(), hashlib.sha256).hexdigest()
    return signature

def api_request(method, endpoint, params=None, data=None):
    url = BASE_URL + endpoint
    timestamp = int(time.time() * 1000)
    headers = {"X-BX-APIKEY": API_KEY}

    if params is None:
        params = {}
    params["timestamp"] = timestamp

    if method.upper() in ["GET", "DELETE"]:
        params["signature"] = sign_request(params, SECRET_KEY)
        response = requests.request(method, url, headers=headers, params=params)
    else:
        params["signature"] = sign_request(params, SECRET_KEY)
        response = requests.request(method, url, headers=headers, data=data, params=params)

    if response.status_code != 200:
        logger.error(f"API Error: {response.status_code} - {response.text}")
        return None
    return response.json()

def get_current_price(symbol):
    endpoint = "/openApi/spot/v1/ticker/price"
    params = {"symbol": symbol}
    data = api_request("GET", endpoint, params)
    if data and "data" in data and "price" in data["data"]:
        return float(data["data"]["price"])
    return None

def get_klines(symbol, interval="5m", limit=50):
    endpoint = "/openApi/spot/v1/market/klines"
    params = {
        "symbol": symbol,
        "interval": interval,
        "limit": limit
    }
    data = api_request("GET", endpoint, params)
    if data and "data" in data:
        closes = [float(kline[4]) for kline in data["data"]]
        return closes
    return []

def get_account_balance():
    endpoint = "/openApi/spot/v1/account/balance"
    data = api_request("GET", endpoint)
    if data and "data" in data and "balances" in data["data"]:
        balances = {b["asset"]: {"free": float(b["free"]), "locked": float(b["locked"])} for b in data["data"]["balances"]}
        return balances
    return {}

def place_order(symbol, side, order_type, quantity, price=None):
    endpoint = "/openApi/spot/v1/trade/order"
    params = {
        "symbol": symbol,
        "side": side,
        "type": order_type,
        "quantity": str(quantity)
    }
    if price:
        params["price"] = str(price)

    result = api_request("POST", endpoint, params=params)
    if result and result.get("code") == 0:
        order_id = result["data"]["orderId"]
        logger.info(f"✅ Ордер {side} {quantity} {symbol.split('-')[0]} по {price} исполнен. ID: {order_id}")
        return result["data"]
    else:
        logger.error(f"❌ Ошибка выставления ордера: {result}")
        return None

def cancel_order(symbol, order_id):
    endpoint = "/openApi/spot/v1/trade/cancel"
    params = {
        "symbol": symbol,
        "orderId": order_id
    }
    result = api_request("DELETE", endpoint, params=params)
    if result and result.get("code") == 0:
        logger.info(f"✅ Ордер {order_id} отменён.")
        return True
    else:
        logger.error(f"❌ Ошибка отмены ордера {order_id}: {result}")
        return False

# ============= ИНДИКАТОРЫ =============
def calculate_sma(prices, period):
    if len(prices) < period:
        return None
    return sum(prices[-period:]) / period

def calculate_rsi(prices, period=14):
    if len(prices) < period + 1:
        return 50
    gains = []
    losses = []
    for i in range(1, len(prices[-(period+1):])):
        change = prices[-i] - prices[-(i+1)]
        if change > 0:
            gains.append(change)
            losses.append(0)
        else:
            gains.append(0)
            losses.append(abs(change))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

# ============= ТРЕЙЛИНГ-СТОП =============
def update_trailing_stops():
    """Обновляет трейлинг-стопы для всех активных позиций"""
    global trailing_stops, active_trades

    while True:
        try:
            time.sleep(60)  # проверяем каждую минуту
            current_prices = {}
            for symbol in list(trailing_stops.keys()):
                price = get_current_price(symbol)
                if price:
                    current_prices[symbol] = price

            for symbol, stop_data in list(trailing_stops.items()):
                if symbol not in current_prices:
                    continue

                current_price = current_prices[symbol]
                entry_price = stop_data["entry_price"]
                highest_price = max(stop_data["highest_price"], current_price)
                stop_price = highest_price * (1 - TRAILING_STOP_PCT / 100)

                # Обновляем highest_price
                trailing_stops[symbol]["highest_price"] = highest_price

                # Если цена упала ниже стопа — продаем
                if current_price <= stop_price and symbol in active_trades:
                    logger.info(f"🚨 Трейлинг-стоп сработал для {symbol}! Текущая цена: {current_price}, Стоп: {stop_price}")
                    
                    # Продаем всю позицию
                    quantity = active_trades[symbol]["quantity"]
                    result = place_order(symbol, "SELL", "MARKET", quantity)
                    if result:
                        # Записываем в историю
                        trade_history.append({
                            "symbol": symbol,
                            "side": "SELL",
                            "price": current_price,
                            "quantity": quantity,
                            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            "profit": (current_price - entry_price) * quantity,
                            "type": "trailing_stop"
                        })
                        # Удаляем из активных
                        del active_trades[symbol]
                        del trailing_stops[symbol]

        except Exception as e:
            logger.error(f"Ошибка в трейлинг-стопе: {e}")
            time.sleep(60)

# ============= ОСНОВНАЯ ТОРГОВАЯ ЛОГИКА =============
def trading_engine():
    """Основной торговый движок"""
    global active_trades, trade_history, balance_log, last_total_balance

    logger.info("🚀 Торговый движок запущен!")
    peak_balance = 0

    while True:
        try:
            # Получаем баланс
            balances = get_account_balance()
            prices_cache = {}
            for symbol in SYMBOLS:
                price = get_current_price(symbol)
                if price:
                    prices_cache[symbol] = price
                time.sleep(0.05)

            total_balance = 0.0
            for asset, amount in balances.items():
                if asset == "USDT":
                    total_balance += amount["free"]
                else:
                    pair = f"{asset}-USDT"
                    if pair in prices_cache:
                        total_balance += amount["free"] * prices_cache[pair]

            balance_log.append({
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "balance": total_balance
            })

            if len(balance_log) > 100:
                balance_log.pop(0)

            if peak_balance == 0:
                peak_balance = total_balance

            # Проверка на просадку
            if total_balance < peak_balance * (1 - MAX_DRAWDOWN_PCT / 100):
                logger.critical(f"📉 ДОСТИГНУТА МАКСИМАЛЬНАЯ ПРОСАДКА {MAX_DRAWDOWN_PCT}%! ОСТАНАВЛИВАЕМ ТОРГОВЛЮ.")
                break

            peak_balance = max(peak_balance, total_balance)
            last_total_balance = total_balance

            # Если достигли лимита активных позиций — не открываем новые
            if len(active_trades) >= MAX_ACTIVE_POSITIONS:
                time.sleep(CHECK_INTERVAL)
                continue

            # Анализируем все пары
            signals = []
            for symbol in SYMBOLS:
                prices = get_klines(symbol, "5m", 50)
                if len(prices) < 30:
                    continue

                ma_short = calculate_sma(prices, 10)
                ma_long = calculate_sma(prices, 30)
                rsi = calculate_rsi(prices, 14)

                if ma_short is None or ma_long is None:
                    continue

                current_price = prices[-1]

                # Сигнал на покупку
                if ma_short > ma_long * 1.01 and rsi < 60 and symbol not in active_trades:
                    score = (ma_short / ma_long) * (60 - rsi) / 60
                    signals.append({
                        "symbol": symbol,
                        "signal": "buy",
                        "score": score,
                        "price": current_price
                    })

            # Сортируем по силе сигнала
            signals.sort(key=lambda x: x["score"], reverse=True)

            # Выполняем сделки
            for signal in signals:
                if len(active_trades) >= MAX_ACTIVE_POSITIONS:
                    break

                symbol = signal["symbol"]
                current_price = signal["price"]

                usdt_balance = balances.get("USDT", {}).get("free", 0)
                if usdt_balance < 10:
                    continue

                trade_amount = min(total_balance * (RISK_PER_TRADE_PCT / 100), usdt_balance)
                quantity = round(trade_amount / current_price, 8)

                if quantity <= 0:
                    continue

                logger.info(f"📈 Покупаем {quantity} {symbol.split('-')[0]} по цене {current_price}")
                result = place_order(symbol, "BUY", "MARKET", quantity)
                if result:
                    # Добавляем в активные сделки
                    active_trades[symbol] = {
                        "quantity": quantity,
                        "entry_price": current_price,
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                    # Инициализируем трейлинг-стоп
                    trailing_stops[symbol] = {
                        "entry_price": current_price,
                        "highest_price": current_price,
                        "stop_price": current_price * (1 - TRAILING_STOP_PCT / 100)
                    }
                    # Записываем в историю
                    trade_history.append({
                        "symbol": symbol,
                        "side": "BUY",
                        "price": current_price,
                        "quantity": quantity,
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "type": "signal"
                    })

            time.sleep(CHECK_INTERVAL)

        except Exception as e:
            logger.error(f"Ошибка в торговом движке: {e}")
            time.sleep(60)

# ============= ВЕБ-ИНТЕРФЕЙС =============
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        password = request.form.get('password', '')
        if password == WEB_PASSWORD:
            session['authenticated'] = True
            return redirect(url_for('dashboard'))
        else:
            return render_template_string('''
                <h2>❌ Неверный пароль</h2>
                <form method="post">
                    <input type="password" name="password" placeholder="Введите пароль" required>
                    <button type="submit">Войти</button>
                </form>
                <style>body {font-family: Arial; text-align: center; margin-top: 100px;}</style>
            ''')
    
    return render_template_string('''
        <h2>🔐 Введите пароль для доступа</h2>
        <form method="post">
            <input type="password" name="password" placeholder="Пароль" required>
            <button type="submit">Войти</button>
        </form>
        <style>body {font-family: Arial; text-align: center; margin-top: 100px;}</style>
    ''')

@app.route('/')
def index():
    if not session.get('authenticated'):
        return redirect(url_for('login'))
    return redirect(url_for('dashboard'))

@app.route('/dashboard')
def dashboard():
    if not session.get('authenticated'):
        return redirect(url_for('login'))
    
    # Получаем текущий баланс
    balances = get_account_balance()
    prices_cache = {}
    for symbol in list(active_trades.keys()) + ["BTC-USDT", "ETH-USDT"]:
        price = get_current_price(symbol)
        if price:
            prices_cache[symbol] = price
        time.sleep(0.05)

    total_balance = 0.0
    for asset, amount in balances.items():
        if asset == "USDT":
            total_balance += amount["free"]
        else:
            pair = f"{asset}-USDT"
            if pair in prices_cache:
                total_balance += amount["free"] * prices_cache[pair]

    # HTML-шаблон дашборда
    html_template = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>📊 Smart Trader Dashboard</title>
        <meta http-equiv="refresh" content="30">
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            .card { background: white; padding: 20px; margin: 20px 0; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            h1, h2 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
            .logout { float: right; margin: 20px; }
            .profit { color: green; }
            .loss { color: red; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Smart Trader Dashboard</h1>
            <a href="/logout" class="logout">🚪 Выйти</a>
            
            <div class="card">
                <h2>💰 Общий баланс: {{ total_balance|round(2) }} USDT</h2>
                <p>Активных позиций: {{ active_trades|length }}</p>
                <p>Всего сделок: {{ trade_history|length }}</p>
            </div>

            <div class="card">
                <h2>📈 Активные позиции ({{ active_trades|length }})</h2>
                {% if active_trades %}
                <table>
                    <tr>
                        <th>Пара</th>
                        <th>Кол-во</th>
                        <th>Цена входа</th>
                        <th>Текущая цена</th>
                        <th>Прибыль/Убыток</th>
                        <th>Трейлинг-стоп</th>
                        <th>Время открытия</th>
                    </tr>
                    {% for symbol, trade in active_trades.items() %}
                    <tr>
                        <td>{{ symbol }}</td>
                        <td>{{ trade.quantity|round(6) }}</td>
                        <td>{{ trade.entry_price|round(4) }}</td>
                        <td>{{ prices_cache.get(symbol, 0)|round(4) }}</td>
                        <td class="{% if prices_cache.get(symbol, 0) > trade.entry_price %}profit{% else %}loss{% endif %}">
                            {% if prices_cache.get(symbol, 0) > 0 %}
                                {{ ((prices_cache.get(symbol, 0) - trade.entry_price) * trade.quantity)|round(2) }} USDT
                                ({{ ((prices_cache.get(symbol, 0) / trade.entry_price - 1) * 100)|round(2) }}%)
                            {% endif %}
                        </td>
                        <td>{{ trailing_stops.get(symbol, {}).get('stop_price', 0)|round(4) if trailing_stops.get(symbol) }}</td>
                        <td>{{ trade.timestamp }}</td>
                    </tr>
                    {% endfor %}
                </table>
                {% else %}
                <p>Нет активных позиций</p>
                {% endif %}
            </div>

            <div class="card">
                <h2>📋 История сделок (последние 20)</h2>
                {% if trade_history %}
                <table>
                    <tr>
                        <th>Время</th>
                        <th>Пара</th>
                        <th>Тип</th>
                        <th>Цена</th>
                        <th>Кол-во</th>
                        <th>Прибыль</th>
                    </tr>
                    {% for trade in trade_history[-20:]|reverse %}
                    <tr>
                        <td>{{ trade.timestamp }}</td>
                        <td>{{ trade.symbol }}</td>
                        <td>{{ trade.side }} ({{ trade.type }})</td>
                        <td>{{ trade.price|round(4) }}</td>
                        <td>{{ trade.quantity|round(6) }}</td>
                        <td class="{% if trade.profit and trade.profit > 0 %}profit{% elif trade.profit %}loss{% endif %}">
                            {% if trade.profit %}{{ trade.profit|round(2) }} USDT{% endif %}
                        </td>
                    </tr>
                    {% endfor %}
                </table>
                {% else %}
                <p>Нет истории сделок</p>
                {% endif %}
            </div>
        </div>
    </body>
    </html>
    '''
    
    return render_template_string(
        html_template,
        total_balance=total_balance,
        active_trades=active_trades,
        trade_history=trade_history,
        prices_cache=prices_cache,
        trailing_stops=trailing_stops
    )

@app.route('/api/status')
def api_status():
    if not session.get('authenticated'):
        return jsonify({"error": "Unauthorized"}), 401
    
    return jsonify({
        "balance": last_total_balance,
        "active_trades": len(active_trades),
        "total_trades": len(trade_history),
        "trailing_stops": len(trailing_stops)
    })

@app.route('/logout')
def logout():
    session.pop('authenticated', None)
    return redirect(url_for('login'))

# ============= ЗАПУСК =============
if __name__ == "__main__":
    # Запускаем торговый движок в отдельном потоке
    trading_thread = threading.Thread(target=trading_engine, daemon=True)
    trading_thread.start()
    
    # Запускаем трейлинг-стоп в отдельном потоке
    trailing_thread = threading.Thread(target=update_trailing_stops, daemon=True)
    trailing_thread.start()
    
    # Запускаем веб-сервер
    logger.info("🌐 Веб-интерфейс запущен на http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
