# multicurrency_smart_bot.py
import os
import time
import json
import logging
from datetime import datetime
import requests
import hmac
import hashlib
import urllib.parse
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# ============= НАСТРОЙКИ =============
API_KEY = os.getenv("BINGX_API_KEY")
SECRET_KEY = os.getenv("BINGX_SECRET_KEY")
BASE_URL = "https://open-api.bingx.com"

# Список торговых пар (добавляй любые)
SYMBOLS = [
    "BTC-USDT",
    "ETH-USDT",
    "SOL-USDT",
    "XRP-USDT",
    "DOGE-USDT",
    "ADA-USDT",
    "AVAX-USDT",
    "MATIC-USDT"
]

CHECK_INTERVAL = 300  # секунд (5 минут)
RISK_PER_TRADE_PCT = 1.5  # Риск на сделку в % от капитала
MAX_DRAWDOWN_PCT = 15.0  # Максимальная просадка для остановки
MAX_POSITIONS = 3  # Максимум одновременных позиций

# Параметры индикаторов
MA_SHORT = 10
MA_LONG = 30
RSI_PERIOD = 14
RSI_OVERBOUGHT = 70
RSI_OVERSOLD = 30

# ============= ЛОГИРОВАНИЕ =============
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("multicurrency_bot.log", encoding='utf-8'),
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
        # BingX возвращает: [openTime, open, high, low, close, volume, ...]
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

def cancel_all_orders(symbol):
    endpoint = "/openApi/spot/v1/trade/cancelOrders"
    params = {"symbol": symbol}
    result = api_request("DELETE", endpoint, params=params)
    if result and result.get("code") == 0:
        logger.info(f"✅ Все ордера для {symbol} отменены.")
    else:
        logger.error(f"❌ Ошибка отмены ордеров для {symbol}: {result}")

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

# ============= АНАЛИЗ СИГНАЛА =============
def analyze_symbol(symbol):
    """Анализирует пару и возвращает сигнал: 'buy', 'sell', 'hold'"""
    prices = get_klines(symbol, "5m", 50)
    if len(prices) < MA_LONG:
        return "hold", 0, 0

    ma_short = calculate_sma(prices, MA_SHORT)
    ma_long = calculate_sma(prices, MA_LONG)
    rsi = calculate_rsi(prices, RSI_PERIOD)

    if ma_short is None or ma_long is None:
        return "hold", 0, 0

    current_price = prices[-1]

    # Сигнал на покупку
    if ma_short > ma_long * 1.01 and rsi < RSI_OVERBOUGHT - 10:
        score = (ma_short / ma_long) * (100 - rsi) / 100
        return "buy", score, current_price

    # Сигнал на продажу (если есть актив)
    if ma_short < ma_long * 0.99 and rsi > RSI_OVERSOLD + 10:
        score = (ma_long / ma_short) * (rsi / 100)
        return "sell", score, current_price

    return "hold", 0, 0

# ============= РАСЧЁТ ОБЩЕГО БАЛАНСА В USDT =============
def calculate_total_balance(balances, prices_cache):
    total = 0.0
    for asset, amount in balances.items():
        if asset == "USDT":
            total += amount["free"]
        else:
            pair = f"{asset}-USDT"
            if pair in prices_cache:
                total += amount["free"] * prices_cache[pair]
    return total

# ============= ОСНОВНАЯ ЛОГИКА =============
def main_loop():
    logger.info("🚀 Мультивалютный умный бот запущен!")
    logger.info(f"Торгуемые пары: {', '.join(SYMBOLS)}")

    peak_balance = 0
    active_positions = set()  # Трекаем, по каким парам есть открытые позиции

    while True:
        try:
            # Получаем текущие цены всех пар
            prices_cache = {}
            for symbol in SYMBOLS:
                price = get_current_price(symbol)
                if price:
                    prices_cache[symbol] = price
                time.sleep(0.1)  # чтобы не упереться в рейт-лимит

            # Получаем баланс
            balances = get_account_balance()
            total_balance = calculate_total_balance(balances, prices_cache)
            logger.info(f"💰 Общий баланс: {total_balance:.2f} USDT")

            # Инициализируем пик баланса
            if peak_balance == 0:
                peak_balance = total_balance

            # Проверка на просадку
            if total_balance < peak_balance * (1 - MAX_DRAWDOWN_PCT / 100):
                logger.critical(f"📉 ДОСТИГНУТА МАКСИМАЛЬНАЯ ПРОСАДКА {MAX_DRAWDOWN_PCT}%! ОСТАНАВЛИВАЕМ БОТА.")
                break

            peak_balance = max(peak_balance, total_balance)

            # Анализируем все пары
            signals = []
            for symbol in SYMBOLS:
                signal, score, price = analyze_symbol(symbol)
                if signal in ["buy", "sell"]:
                    signals.append({
                        "symbol": symbol,
                        "signal": signal,
                        "score": score,
                        "price": price
                    })

            # Сортируем по силе сигнала
            signals.sort(key=lambda x: x["score"], reverse=True)

            # Ограничиваем количество одновременных сделок
            executed = 0
            for sig in signals:
                if executed >= MAX_POSITIONS:
                    break

                symbol = sig["symbol"]
                base_asset = symbol.split('-')[0]

                if sig["signal"] == "buy":
                    usdt_balance = balances.get("USDT", {}).get("free", 0)
                    if usdt_balance < 10:
                        logger.info(f"📉 Недостаточно USDT для покупки {symbol}.")
                        continue

                    # Рискуем только частью капитала
                    trade_amount = min(total_balance * (RISK_PER_TRADE_PCT / 100), usdt_balance)
                    quantity = round(trade_amount / sig["price"], 6)

                    logger.info(f"📈 Сильный сигнал на покупку {symbol} (score: {sig['score']:.2f})")
                    result = place_order(symbol, "BUY", "MARKET", quantity)
                    if result:
                        active_positions.add(symbol)
                        executed += 1

                elif sig["signal"] == "sell":
                    asset_balance = balances.get(base_asset, {}).get("free", 0)
                    if asset_balance < 0.0001:
                        logger.info(f"📉 Нет активов {base_asset} для продажи.")
                        continue

                    logger.info(f"📉 Сильный сигнал на продажу {symbol} (score: {sig['score']:.2f})")
                    result = place_order(symbol, "SELL", "MARKET", asset_balance)
                    if result:
                        active_positions.discard(symbol)  # удаляем из активных позиций
                        executed += 1

            logger.info(f"💤 Спим {CHECK_INTERVAL} секунд...")
            time.sleep(CHECK_INTERVAL)

        except KeyboardInterrupt:
            logger.info("🛑 Бот остановлен пользователем.")
            break
        except Exception as e:
            logger.error(f"⚠️ Ошибка в основном цикле: {e}")
            time.sleep(60)

# ============= ЗАПУСК =============
if __name__ == "__main__":
    main_loop()
