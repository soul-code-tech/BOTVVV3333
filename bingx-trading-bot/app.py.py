import os
import time
import json
import requests
import numpy as np
import pandas as pd
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from dotenv import load_dotenv
from datetime import datetime, timedelta
import hmac
import hashlib

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'default_secret_key')

# BingX API configuration
API_KEY = os.getenv('BINGX_API_KEY')
API_SECRET = os.getenv('BINGX_API_SECRET')
BASE_URL = "https://open-api.bingx.com"

# Bot configuration
BOT_CONFIG = {
    'symbol': 'BTC-USDT',
    'interval': '1h',
    'initial_balance': 1000.0,
    'trade_size': 0.1,
    'stochastic_k_period': 14,
    'stochastic_d_period': 3,
    'rsi_period': 14,
    'moving_avg_short': 5,
    'moving_avg_long': 20,
    'take_profit_pct': 1.5,
    'stop_loss_pct': 0.5,
    'max_position_size': 0.5,
    'trading_enabled': False,
    'risk_level': 'medium',
    'last_trade_time': 0,
    'status': 'inactive',
    'error_count': 0,
    'last_error': ''
}

# Load configuration from file if exists
if os.path.exists('config.json'):
    with open('config.json', 'r') as f:
        BOT_CONFIG.update(json.load(f))

# Set admin password from environment variable
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'default_password')

def get_server_time():
    """Get current server time from BingX API"""
    url = f"{BASE_URL}/openApi/swap/v2/server/time"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        return data['data']['serverTime']
    except Exception as e:
        print(f"Error getting server time: {str(e)}")
        return int(time.time() * 1000)

def generate_signature(params):
    """Generate HMAC SHA256 signature for API request"""
    query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
    signature = hmac.new(
        API_SECRET.encode('utf-8'),
        query_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return signature

def handle_api_error(response):
    """Handle BingX API errors"""
    if 'code' not in response:
        return None
    
    code = response['code']
    msg = response.get('msg', 'Unknown error')
    
    # Handle specific error codes
    if code == 400:
        return "Invalid request format"
    elif code == 401:
        return "Invalid API Key"
    elif code == 403:
        return "Access denied"
    elif code == 429:
        return "Too many requests. Please wait before retrying."
    elif code == 418:
        return "IP has been banned. Please check your request frequency."
    elif code == 500:
        return "Internal server error"
    elif code == 504:
        return "API server timeout. Request status unknown."
    elif code == 100001:
        return "Signature verification failed"
    elif code == 100500:
        return "Internal system error"
    elif code == 80012:
        return "Service unavailable"
    elif code == 80014:
        return "Invalid parameter"
    elif code == 80016:
        return "Order does not exist"
    elif code == 80017:
        return "Position does not exist"
    elif code == 80020:
        return "Risk forbidden"
    elif code == 100004:
        return "Permission denied as the API key was created without the permission"
    elif code == 100419:
        return "IP does not match IP whitelist"
    elif code == 101204:
        return "Insufficient margin"
    elif code == 80013:
        return "The number of your entrusted orders has reached the system limit. If you need to place an order, please cancel other orders first"
    elif code == 80018:
        return "Order is already filled"
    elif code == 80019:
        return "The order is being processed. Please use the allOrders api to retrieve the order details later"
    elif code == 100400:
        return "arguments invalid or missing arguments"
    elif code == 100412:
        return "Null signature"
    elif code == 100413:
        return "Incorrect apiKey"
    elif code == 100421:
        return "Null timestamp or timestamp mismatch"
    elif code == 100410:
        return "Rate limitation"
    elif code == 101209:
        return "The maximum position value for this leverage is ** USDT"
    elif code == 101212:
        return "Failed. Please check if you have pending orders under the trading pair. If yes, please cancel them and try again"
    elif code == 101215:
        return "The Maker (Post Only) order ensures that the user always acts as a maker. If the order would immediately match with available orders in the market, it will be canceled."
    elif code == 101414:
        return "The maximum leverage for the trading pair is *, please reduce the leverage"
    elif code == 101415:
        return "This trading pair is suspended from opening new position"
    elif code == 101460:
        return "The order price should be higher than the estimated liquidation price of the long position"
    elif code == 101500:
        return "rpc timeout"
    elif code == 101514:
        return "You're temporarily suspended from opening positions. Please try again later"
    elif code == 109201:
        return "The same order number is only allowed to be submitted once within 1 second."
    elif code == 101211:
        return "Order price should be within allowed range"
    elif code == 80001:
        return "tickers is nil"
    elif code == 101400:
        return "No position to close"
    elif code == 100400:
        return "Invalid parameters"
    else:
        return f"Error {code}: {msg}"

def make_api_request(endpoint, method='GET', params=None, signed=False):
    """Make a request to BingX API"""
    timestamp = int(time.time() * 1000)
    
    if params is None:
        params = {}
    
    # Add common parameters
    params['timestamp'] = timestamp
    params['recvWindow'] = 5000
    
    if signed:
        # Generate signature
        signature = generate_signature(params)
        params['signature'] = signature
    
    # Build URL
    url = f"{BASE_URL}{endpoint}"
    
    headers = {
        'X-BX-APIKEY': API_KEY,
        'Content-Type': 'application/json'
    }
    
    try:
        if method == 'GET':
            response = requests.get(url, params=params, headers=headers)
        elif method == 'POST':
            response = requests.post(url, json=params, headers=headers)
        elif method == 'DELETE':
            response = requests.delete(url, params=params, headers=headers)
        
        response.raise_for_status()
        data = response.json()
        
        # Check for API-specific errors
        if 'code' in data and data['code'] != 0:
            error_msg = handle_api_error(data)
            return {'code': data['code'], 'msg': error_msg}
        
        return data
    except requests.exceptions.HTTPError as e:
        # Handle HTTP errors
        error_data = e.response.json() if e.response.text else {}
        error_msg = handle_api_error(error_data)
        return {'code': e.response.status_code, 'msg': error_msg}
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return {'code': 500, 'msg': str(e)}

def get_klines(symbol, interval, limit=100):
    """Get kline/candlestick data"""
    endpoint = "/openApi/swap/v3/quote/klines"
    params = {
        'symbol': symbol,
        'interval': interval,
        'limit': limit
    }
    return make_api_request(endpoint, params=params)

def get_account_info():
    """Get account information"""
    endpoint = "/openApi/spot/v1/account"
    return make_api_request(endpoint, signed=True)

def place_order(symbol, side, order_type, quantity, price=None):
    """Place a new order"""
    endpoint = "/openApi/spot/v1/order"
    params = {
        'symbol': symbol,
        'side': side,
        'type': order_type,
        'quantity': quantity
    }
    
    if price is not None:
        params['price'] = price
    
    # For limit orders, check if it's a maker or taker
    is_maker = order_type == 'LIMIT'
    
    order = make_api_request(endpoint, method='POST', params=params, signed=True)
    
    if 'code' in order and order['code'] == 0:
        # Calculate commission
        commission = calculate_commission(quantity, is_maker)
        order['commission'] = commission
        order['total_cost'] = quantity * price - commission if side == 'BUY' else quantity * price + commission
    
    return order

def cancel_order(symbol, order_id):
    """Cancel an order"""
    endpoint = "/openApi/spot/v1/order"
    params = {
        'symbol': symbol,
        'orderId': order_id
    }
    return make_api_request(endpoint, method='DELETE', params=params, signed=True)

def get_open_orders(symbol):
    """Get open orders"""
    endpoint = "/openApi/spot/v1/openOrders"
    params = {'symbol': symbol}
    return make_api_request(endpoint, params=params, signed=True)

def calculate_commission(trade_size, is_maker=True):
    """Calculate trading commission based on trade size and order type"""
    # BingX spot trading fees (example values)
    maker_fee = 0.0002  # 0.02%
    taker_fee = 0.001   # 0.1%
    
    fee_rate = maker_fee if is_maker else taker_fee
    commission = trade_size * fee_rate
    return commission

def calculate_stochastic(klines, k_period=14, d_period=3):
    """Calculate stochastic oscillator"""
    closes = [float(k[4]) for k in klines]
    highs = [float(k[2]) for k in klines]
    lows = [float(k[3]) for k in klines]
    
    # Calculate %K
    highest_high = [max(highs[i-k_period+1:i+1]) for i in range(k_period-1, len(highs))]
    lowest_low = [min(lows[i-k_period+1:i+1]) for i in range(k_period-1, len(lows))]
    
    k_values = []
    for i in range(len(highest_high)):
        if highest_high[i] - lowest_low[i] != 0:
            k = 100 * (closes[i+k_period-1] - lowest_low[i]) / (highest_high[i] - lowest_low[i])
        else:
            k = 50
        k_values.append(k)
    
    # Calculate %D (moving average of %K)
    d_values = []
    for i in range(d_period-1, len(k_values)):
        d = sum(k_values[i-d_period+1:i+1]) / d_period
        d_values.append(d)
    
    return k_values[-1] if k_values else 50, d_values[-1] if d_values else 50

def calculate_rsi(klines, period=14):
    """Calculate RSI"""
    closes = [float(k[4]) for k in klines]
    
    # Calculate price changes
    changes = [closes[i] - closes[i-1] for i in range(1, len(closes))]
    
    # Calculate gains and losses
    gains = [max(0, change) for change in changes]
    losses = [max(0, -change) for change in changes]
    
    # Calculate average gains and losses
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    
    # Calculate RSI
    rsi_values = []
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period-1) + gains[i]) / period
        avg_loss = (avg_loss * (period-1) + losses[i]) / period
        
        if avg_loss == 0:
            rsi = 100
        else:
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))
        
        rsi_values.append(rsi)
    
    return rsi_values[-1] if rsi_values else 50

def calculate_moving_averages(klines, short_period=5, long_period=20):
    """Calculate moving averages"""
    closes = [float(k[4]) for k in klines]
    
    short_ma = sum(closes[-short_period:]) / short_period
    long_ma = sum(closes[-long_period:]) / long_period
    
    return short_ma, long_ma

def get_market_sentiment():
    """Get market sentiment (simplified - in reality this would use external data sources)"""
    # This is a placeholder - in a real bot, this would use news API, social media sentiment, etc.
    return "neutral"

def analyze_market():
    """Analyze market conditions and generate trading signals"""
    klines = get_klines(BOT_CONFIG['symbol'], BOT_CONFIG['interval'])
    
    if 'code' in klines and klines['code'] != 0:
        return {'error': klines.get('msg', 'Unknown error')}
    
    # Calculate indicators
    stoch_k, stoch_d = calculate_stochastic(klines, 
                                          BOT_CONFIG['stochastic_k_period'], 
                                          BOT_CONFIG['stochastic_d_period'])
    rsi = calculate_rsi(klines, BOT_CONFIG['rsi_period'])
    short_ma, long_ma = calculate_moving_averages(klines, 
                                                 BOT_CONFIG['moving_avg_short'], 
                                                 BOT_CONFIG['moving_avg_long'])
    sentiment = get_market_sentiment()
    
    # Generate trading signal
    signal = 'hold'
    
    # Check stochastic for oversold/overbought
    if stoch_k < 20 and stoch_d < 20 and stoch_k > stoch_d:
        signal = 'buy'
    elif stoch_k > 80 and stoch_d > 80 and stoch_k < stoch_d:
        signal = 'sell'
    
    # Check RSI
    if rsi < 30 and signal != 'sell':
        signal = 'buy'
    elif rsi > 70 and signal != 'buy':
        signal = 'sell'
    
    # Check moving averages crossover
    if short_ma > long_ma and signal != 'sell':
        signal = 'buy'
    elif short_ma < long_ma and signal != 'buy':
        signal = 'sell'
    
    # Apply sentiment
    if sentiment == 'bullish' and signal != 'sell':
        signal = 'buy'
    elif sentiment == 'bearish' and signal != 'buy':
        signal = 'sell'
    
    return {
        'stochastic': {'k': stoch_k, 'd': stoch_d},
        'rsi': rsi,
        'moving_averages': {'short': short_ma, 'long': long_ma},
        'sentiment': sentiment,
        'signal': signal
    }

def execute_trade():
    """Execute a trade based on the analysis"""
    analysis = analyze_market()
    
    if 'error' in analysis:
        return {'error': analysis['error']}
    
    # Check if we should trade
    if not BOT_CONFIG['trading_enabled']:
        return {'status': 'trading disabled'}
    
    # Check cooldown period
    if time.time() - BOT_CONFIG['last_trade_time'] < 3600:  # 1 hour cooldown
        return {'status': 'cooldown period active'}
    
    # Get account balance
    account = get_account_info()
    if 'code' in account and account['code'] != 0:
        return {'error': account.get('msg', 'Unknown error')}
    
    # Get current price
    # In a real bot, we'd get the current price from market data
    # For simplicity, we'll use the last price from the account info
    current_price = 0
    for balance in account['data']['balances']:
        if balance['asset'] == BOT_CONFIG['symbol'].split('-')[0]:
            current_price = float(balance['price'])
            break
    
    if current_price == 0:
        return {'error': 'Could not get current price'}
    
    # Calculate trade size
    balance = 0
    for balance_item in account['data']['balances']:
        if balance_item['asset'] == BOT_CONFIG['symbol'].split('-')[1]:
            balance = float(balance_item['free'])
            break
    
    trade_size = BOT_CONFIG['trade_size'] * balance / current_price
    
    # Check position size limits
    max_position = BOT_CONFIG['max_position_size'] * balance / current_price
    if trade_size > max_position:
        trade_size = max_position
    
    # Execute trade based on signal
    if analysis['signal'] == 'buy':
        # Check if we already have an open position
        open_orders = get_open_orders(BOT_CONFIG['symbol'])
        if 'code' in open_orders and open_orders['code'] != 0:
            return {'error': open_orders.get('msg', 'Unknown error')}
        
        if not open_orders['data']:
            # Place buy order
            order = place_order(
                BOT_CONFIG['symbol'],
                'BUY',
                'LIMIT',
                trade_size,
                current_price
            )
            if 'code' in order and order['code'] == 0:
                BOT_CONFIG['last_trade_time'] = time.time()
                save_config()
                return {'status': 'buy order placed'}
            else:
                return {'error': order.get('msg', 'Unknown error')}
        else:
            return {'status': 'already have open position'}
    
    elif analysis['signal'] == 'sell':
        # Check if we have a position to sell
        account = get_account_info()
        if 'code' in account and account['code'] != 0:
            return {'error': account.get('msg', 'Unknown error')}
        
        balance = 0
        for balance_item in account['data']['balances']:
            if balance_item['asset'] == BOT_CONFIG['symbol'].split('-')[0]:
                balance = float(balance_item['free'])
                break
        
        if balance > 0:
            # Place sell order
            order = place_order(
                BOT_CONFIG['symbol'],
                'SELL',
                'LIMIT',
                balance,
                current_price
            )
            if 'code' in order and order['code'] == 0:
                BOT_CONFIG['last_trade_time'] = time.time()
                save_config()
                return {'status': 'sell order placed'}
            else:
                return {'error': order.get('msg', 'Unknown error')}
        else:
            return {'status': 'no position to sell'}
    
    return {'status': 'no trade executed'}

def save_config():
    """Save current bot configuration to file"""
    with open('config.json', 'w') as f:
        json.dump(BOT_CONFIG, f)

def check_errors():
    """Check for errors and take corrective action"""
    # This is a simplified error checking function
    # In a real bot, this would check for specific error codes and take appropriate action
    pass

def run_bot():
    """Main bot loop"""
    while True:
        try:
            # Check for errors and take corrective action
            check_errors()
            
            # Execute trade if conditions are met
            trade_result = execute_trade()
            print(f"Bot action: {trade_result}")
            
            # Save configuration
            save_config()
            
            # Sleep for a while before next iteration
            time.sleep(60)  # Check every minute
        except Exception as e:
            print(f"Bot error: {str(e)}")
            BOT_CONFIG['error_count'] += 1
            BOT_CONFIG['last_error'] = str(e)
            save_config()
            time.sleep(300)  # Wait 5 minutes on error

# Template filters
@app.template_filter('timestamp_to_datetime')
def timestamp_to_datetime(timestamp):
    if timestamp == 0:
        return "Never"
    dt = datetime.fromtimestamp(timestamp)
    return dt.strftime("%Y-%m-%d %H:%M:%S")

# Authentication routes
@app.before_request
def check_auth():
    # Skip authentication for static files and login page
    if request.endpoint in ['static', 'login'] or request.path.startswith('/static/'):
        return
    
    # Check if user is authenticated
    if 'authenticated' not in session:
        return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        password = request.form.get('password')
        if password == ADMIN_PASSWORD:
            session['authenticated'] = True
            return redirect(url_for('index'))
        else:
            return render_template('login.html', error="Invalid password")
    
    return render_template('login.html')

# Web interface routes
@app.route('/')
def index():
    return render_template('index.html', config=BOT_CONFIG)

@app.route('/config', methods=['GET', 'POST'])
def config():
    if request.method == 'POST':
        # Update configuration from form
        for key in BOT_CONFIG:
            if key in request.form:
                if isinstance(BOT_CONFIG[key], float):
                    BOT_CONFIG[key] = float(request.form[key])
                elif isinstance(BOT_CONFIG[key], bool):
                    BOT_CONFIG[key] = request.form[key] == 'on'
                else:
                    BOT_CONFIG[key] = request.form[key]
        
        # Save configuration
        save_config()
        return redirect(url_for('index'))
    
    return render_template('config.html', config=BOT_CONFIG)

@app.route('/status')
def status():
    # Get current market data
    klines = get_klines(BOT_CONFIG['symbol'], BOT_CONFIG['interval'])
    analysis = analyze_market()
    
    return jsonify({
        'status': BOT_CONFIG['status'],
        'last_trade_time': BOT_CONFIG['last_trade_time'],
        'error_count': BOT_CONFIG['error_count'],
        'last_error': BOT_CONFIG['last_error'],
        'analysis': analysis,
        'klines': klines
    })

@app.route('/start')
def start_bot():
    BOT_CONFIG['trading_enabled'] = True
    BOT_CONFIG['status'] = 'active'
    save_config()
    return jsonify({'status': 'bot started'})

@app.route('/stop')
def stop_bot():
    BOT_CONFIG['trading_enabled'] = False
    BOT_CONFIG['status'] = 'inactive'
    save_config()
    return jsonify({'status': 'bot stopped'})

@app.route('/reset')
def reset_bot():
    # Reset to default configuration
    BOT_CONFIG.update({
        'symbol': 'BTC-USDT',
        'interval': '1h',
        'initial_balance': 1000.0,
        'trade_size': 0.1,
        'stochastic_k_period': 14,
        'stochastic_d_period': 3,
        'rsi_period': 14,
        'moving_avg_short': 5,
        'moving_avg_long': 20,
        'take_profit_pct': 1.5,
        'stop_loss_pct': 0.5,
        'max_position_size': 0.5,
        'trading_enabled': False,
        'risk_level': 'medium',
        'last_trade_time': 0,
        'status': 'inactive',
        'error_count': 0,
        'last_error': ''
    })
    save_config()
    return jsonify({'status': 'bot reset'})

if __name__ == '__main__':
    # Start bot in background thread
    import threading
    bot_thread = threading.Thread(target=run_bot)
    bot_thread.daemon = True
    bot_thread.start()
    
    # Run Flask app
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))