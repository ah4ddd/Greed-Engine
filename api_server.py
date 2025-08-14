from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from backend.exchange import TradingInterface
from backend.bot_core import TradingBot
from backend.db import init_db, get_account_balance, get_trade_history, save_settings, log_trade
from backend.backtest import run_backtest
import os
import threading
import time
import pandas as pd

app = Flask(__name__, static_folder='frontend/build')
CORS(app)

init_db()

# Bot state
bot_running = False
bot_thread = None
current_bot = None
current_interface = None

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/balance', methods=['GET'])
def get_balance():
    balance = get_account_balance()
    return jsonify(balance)

@app.route('/api/trades', methods=['GET'])
def get_trades():
    trades = get_trade_history()
    return jsonify(trades)

@app.route('/api/ohlcv', methods=['GET'])
def get_ohlcv():
    """Get candlestick data for charts"""
    symbol = request.args.get('symbol', 'BTC/USDT')
    timeframe = request.args.get('timeframe', '1m')
    limit = int(request.args.get('limit', 100))

    try:
        # Create a temporary interface to get price data
        temp_interface = TradingInterface('', '', 'binance', False)
        df = temp_interface.fetch_ohlcv(symbol, timeframe, limit)

        # Convert to format needed for charts
        ohlcv_data = []
        for _, row in df.iterrows():
            ohlcv_data.append({
                'timestamp': int(row['timestamp'].timestamp() * 1000),
                'open': float(row['open']),
                'high': float(row['high']),
                'low': float(row['low']),
                'close': float(row['close']),
                'volume': float(row['volume'])
            })

        return jsonify({
            'symbol': symbol,
            'timeframe': timeframe,
            'data': ohlcv_data
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/current-price', methods=['GET'])
def get_current_price():
    """Get current price for a symbol"""
    symbol = request.args.get('symbol', 'BTC/USDT')

    try:
        temp_interface = TradingInterface('', '', 'binance', False)
        df = temp_interface.fetch_ohlcv(symbol, '1m', 1)
        current_price = float(df['close'].iloc[-1])

        return jsonify({
            'symbol': symbol,
            'price': current_price,
            'timestamp': int(time.time() * 1000)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/start', methods=['POST'])
def start_bot():
    global bot_running, bot_thread, current_bot, current_interface

    data = request.get_json()
    api_key = data.get('api_key', '')
    api_secret = data.get('api_secret', '')
    exchange = data.get('exchange', 'binance')
    symbol = data.get('symbol', 'BTC/USDT')
    real_mode = data.get('real_mode', False)
    risk = float(data.get('risk', 1.0))
    stop_loss = float(data.get('stop_loss', 1.0))
    take_profit = float(data.get('take_profit', 2.0))

    if bot_running:
        return jsonify({"error": "Bot is already running"}), 400

    try:
        current_interface = TradingInterface(api_key, api_secret, exchange, real_mode)
        current_bot = TradingBot(current_interface, symbol, risk, stop_loss, take_profit)

        def run_bot():
            global bot_running
            while bot_running:
                try:
                    current_bot.run_once()
                    time.sleep(10)  # Check every 10 seconds for more activity
                except Exception as e:
                    print(f"Bot error: {e}")
                    time.sleep(10)

        bot_running = True
        bot_thread = threading.Thread(target=run_bot)
        bot_thread.daemon = True
        bot_thread.start()

        return jsonify({"message": "Bot started successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/stop', methods=['POST'])
def stop_bot():
    global bot_running
    bot_running = False
    return jsonify({"message": "Bot stopped"})

@app.route('/api/status', methods=['GET'])
def bot_status():
    return jsonify({"running": bot_running})

@app.route('/api/backtest', methods=['POST'])
def backtest():
    data = request.get_json()
    symbol = data.get('symbol', 'BTC/USDT')
    years = int(data.get('years', 2))
    risk = float(data.get('risk', 1.0))
    stop_loss = float(data.get('stop_loss', 1.0))
    take_profit = float(data.get('take_profit', 2.0))

    results = run_backtest(symbol, years, risk, stop_loss, take_profit)
    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
