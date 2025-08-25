from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from backend.exchange import TradingInterface
from backend.bot_core import TradingBot, MultiPairTradingBot, HighFrequencyTradingBot, SuperAggressiveMultiPairBot
import os
from backend.db import (init_all_databases, get_account_balance, get_trade_history,
save_settings, log_trade, set_trading_mode, get_trading_mode,
migrate_existing_database)
from backend.backtest import run_backtest
import os
import threading
import time
import pandas as pd
import json

app = Flask(__name__, static_folder='frontend/build')
CORS(app)

# Migrate existing database before initialization
migrate_existing_database()
init_all_databases()

# Bot state
bot_running = False
bot_thread = None
current_bot = None
current_interface = None

# Config file
CONFIG_FILE = 'bot_config.json'

def load_config():
    """Load saved configuration"""
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading config: {e}")
    return {}

def save_config(config_data):
    """Save configuration to file"""
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config_data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False

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

# NEW: Bot Performance Endpoint (FIXED)
@app.route('/api/bot-performance', methods=['GET'])
def get_bot_performance():
    """Get current bot performance statistics for aggressive modes"""
    global current_bot

    try:
        if not current_bot:
            return jsonify({
                'total_pnl': 0.0,
                'total_trades': 0,
                'win_count': 0,
                'loss_count': 0,
                'win_rate': 0.0,
                'consecutive_losses': 0,
                'open_positions': 0
            })

        # Get recent trades for performance calculation
        trades = get_trade_history()

        # Calculate performance stats
        total_pnl = sum(trade.get('pnl', 0) for trade in trades)
        total_trades = len(trades)
        winning_trades = [t for t in trades if t.get('pnl', 0) > 0]
        losing_trades = [t for t in trades if t.get('pnl', 0) < 0]

        win_count = len(winning_trades)
        loss_count = len(losing_trades)
        win_rate = (win_count / total_trades * 100) if total_trades > 0 else 0.0

        # Get consecutive losses from bot if available
        consecutive_losses = getattr(current_bot, 'consecutive_losses', 0)

        # Estimate open positions (this would need to be tracked in your bot)
        open_positions = getattr(current_bot, 'active_positions', 0) if hasattr(current_bot, 'active_positions') else 0

        return jsonify({
            'total_pnl': round(total_pnl, 2),
            'total_trades': total_trades,
            'win_count': win_count,
            'loss_count': loss_count,
            'win_rate': round(win_rate, 1),
            'consecutive_losses': consecutive_losses,
            'open_positions': open_positions
        })

    except Exception as e:
        print(f"Error fetching bot performance: {e}")
        return jsonify({
            'total_pnl': 0.0,
            'total_trades': 0,
            'win_count': 0,
            'loss_count': 0,
            'win_rate': 0.0,
            'consecutive_losses': 0,
            'open_positions': 0
        })

# NEW: Trading Mode Management
@app.route('/api/trading-mode', methods=['GET'])
def get_current_trading_mode():
    """Get current trading mode"""
    return jsonify({
        'mode': get_trading_mode(),
        'available_modes': ['paper', 'live']
    })

@app.route('/api/trading-mode', methods=['POST'])
def set_current_trading_mode():
    """Set current trading mode"""
    data = request.get_json()
    new_mode = data.get('mode', 'paper').lower()

    if new_mode not in ['paper', 'live']:
        return jsonify({'error': 'Invalid trading mode. Must be "paper" or "live"'}), 400

    # Stop bot if running when switching modes
    global bot_running
    if bot_running:
        bot_running = False
        time.sleep(1)  # Give bot time to stop

    set_trading_mode(new_mode)

    # Update environment variable
    os.environ['TRADING_MODE'] = new_mode

    return jsonify({
        'message': f'Trading mode switched to {new_mode}',
        'mode': new_mode
    })

@app.route('/api/database-stats', methods=['GET'])
def get_database_stats():
    """Get stats from both databases for comparison"""
    current_mode = get_trading_mode()

    # Get paper stats
    set_trading_mode('paper')
    paper_balance = get_account_balance()
    paper_trades = get_trade_history()

    # Get live stats
    set_trading_mode('live')
    live_balance = get_account_balance()
    live_trades = get_trade_history()

    # Restore original mode
    set_trading_mode(current_mode)

    return jsonify({
        'current_mode': current_mode,
        'paper': {
            'balance': paper_balance,
            'trade_count': len(paper_trades),
            'recent_trades': paper_trades[:5] if paper_trades else []
        },
        'live': {
            'balance': live_balance,
            'trade_count': len(live_trades),
            'recent_trades': live_trades[:5] if live_trades else []
        }
    })

# Save configuration endpoint
@app.route('/api/save-config', methods=['POST'])
def save_configuration():
    """Save trading configuration"""
    try:
        config_data = request.get_json()
        # Validate required fields
        required_fields = ['strategy_type', 'risk', 'stop_loss', 'take_profit']
        for field in required_fields:
            if field not in config_data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        if save_config(config_data):
            return jsonify({'message': 'Configuration saved successfully'})
        else:
            return jsonify({'error': 'Failed to save configuration'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Load configuration endpoint
@app.route('/api/load-config', methods=['GET'])
def load_configuration():
    """Load saved trading configuration"""
    try:
        config = load_config()
        return jsonify(config)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ohlcv', methods=['GET'])
def get_ohlcv():
    """Get candlestick data for charts"""
    # FIXED: No default fallback to BTC/USDT - require symbol parameter
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({'error': 'Symbol parameter is required'}), 400

    timeframe = request.args.get('timeframe', '1m')
    limit = int(request.args.get('limit', 100))
    trading_mode = request.args.get('trading_mode', 'spot')

    try:
        # Create a temporary interface to get price data
        temp_interface = TradingInterface('', '', 'binance', False, trading_mode)
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

# NEW AGGRESSIVE TRADING ENDPOINTS ADDED BELOW

@app.route('/api/ohlcv-fast', methods=['GET'])
def get_fast_ohlcv():
    """Get 5-minute candlestick data for fast trading"""
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({'error': 'Symbol parameter is required'}), 400

    limit = int(request.args.get('limit', 200))  # More data for analysis
    trading_mode = request.args.get('trading_mode', 'spot')

    try:
        temp_interface = TradingInterface('', '', 'binance', False, trading_mode)
        # Use 5-minute timeframe for faster signals
        df = temp_interface.fetch_ohlcv(symbol, '5m', limit)

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
            'timeframe': '5m',
            'data': ohlcv_data,
            'message': f'Fast trading data for {symbol} (5-min candles)'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/start-fast', methods=['POST'])
def start_fast_bot():
    """Start the aggressive high-frequency trading bot"""
    global bot_running, bot_thread, current_bot, current_interface

    data = request.get_json()
    api_key = data.get('api_key', '')
    api_secret = data.get('api_secret', '')
    exchange = data.get('exchange', 'binance')
    symbol = data.get('symbol')
    if not symbol:
        return jsonify({"error": "Trading pair (symbol) is required"}), 400

    real_mode = data.get('real_mode', False)
    risk = float(data.get('risk', 2.0))  # Default higher risk
    stop_loss = float(data.get('stop_loss', 1.5))  # Minimum 1.5%
    take_profit = float(data.get('take_profit', 2.5))  # Minimum 2.5%
    strategy_type = data.get('strategy_type', 'aggressive_ema')
    trade_amount = data.get('trade_amount')

    trading_mode = data.get('trading_mode', 'spot')
    leverage = int(data.get('leverage', 1))
    kill_switch_threshold = int(data.get('kill_switch_threshold', 15))  # More lenient

    db_mode = 'live' if real_mode else 'paper'
    set_trading_mode(db_mode)

    if bot_running:
        return jsonify({"error": "Bot is already running"}), 400

    try:
        current_interface = TradingInterface(
            api_key, api_secret, exchange, real_mode, trading_mode, leverage
        )

        # Use the new high-frequency bot
        current_bot = HighFrequencyTradingBot(
            current_interface,
            symbol,
            risk,
            stop_loss,
            take_profit,
            strategy_type=strategy_type,
            trade_amount=trade_amount,
            kill_switch_threshold=kill_switch_threshold
        )

        def run_fast_bot():
            global bot_running
            while bot_running:
                try:
                    current_bot.run_once()

                    if current_bot.is_kill_switch_active():
                        print("Kill switch triggered - stopping fast bot")
                        bot_running = False
                        break

                    # Much faster execution - check every 5 seconds
                    time.sleep(5)

                except Exception as e:
                    print(f"Fast bot error: {e}")
                    time.sleep(5)

        bot_running = True
        bot_thread = threading.Thread(target=run_fast_bot)
        bot_thread.daemon = True
        bot_thread.start()

        strategy_name = "AGGRESSIVE EMA" if strategy_type == "aggressive_ema" else "BREAKOUT"

        return jsonify({
            "message": f"FAST BOT started! Trading {symbol} with {strategy_name} strategy | Risk: {risk}% | 5-min candles | 30s cooldown"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/start-super-aggressive', methods=['POST'])
def start_super_aggressive_bot():
    """Start the super aggressive multi-pair trading bot"""
    global bot_running, bot_thread, current_bot, current_interface

    data = request.get_json()
    api_key = data.get('api_key', '')
    api_secret = data.get('api_secret', '')
    exchange = data.get('exchange', 'binance')

    # Multi-pair configuration
    symbols = data.get('symbols', [])
    if not symbols or len(symbols) == 0:
        return jsonify({"error": "At least one trading pair is required"}), 400

    real_mode = data.get('real_mode', False)
    risk = float(data.get('risk', 3.0))  # Higher total risk
    stop_loss = float(data.get('stop_loss', 1.5))
    take_profit = float(data.get('take_profit', 2.5))
    strategy_type = data.get('strategy_type', 'aggressive_ema')
    trade_amount = data.get('trade_amount')

    trading_mode = data.get('trading_mode', 'spot')
    leverage = int(data.get('leverage', 1))
    kill_switch_threshold = int(data.get('kill_switch_threshold', 20))  # Very lenient

    db_mode = 'live' if real_mode else 'paper'
    set_trading_mode(db_mode)

    if bot_running:
        return jsonify({"error": "Bot is already running"}), 400

    try:
        current_interface = TradingInterface(
            api_key, api_secret, exchange, real_mode, trading_mode, leverage
        )

        # Use the super aggressive multi-pair bot
        current_bot = SuperAggressiveMultiPairBot(
            current_interface,
            symbols,
            risk,
            stop_loss,
            take_profit,
            strategy_type=strategy_type,
            trade_amount=trade_amount,
            kill_switch_threshold=kill_switch_threshold
        )

        def run_super_aggressive_bot():
            global bot_running
            while bot_running:
                try:
                    current_bot.run_once()

                    if current_bot.is_kill_switch_active():
                        print("Kill switch triggered - stopping super aggressive bot")
                        bot_running = False
                        break

                    # MAXIMUM FREQUENCY - check every 15 seconds
                    time.sleep(15)

                except Exception as e:
                    print(f"Super aggressive bot error: {e}")
                    time.sleep(15)

        bot_running = True
        bot_thread = threading.Thread(target=run_super_aggressive_bot)
        bot_thread.daemon = True
        bot_thread.start()

        strategy_name = "AGGRESSIVE EMA" if strategy_type == "aggressive_ema" else "BREAKOUT"

        return jsonify({
            "message": f"SUPER AGGRESSIVE BOT started! Trading {len(symbols)} pairs: {', '.join(symbols[:5])}{'...' if len(symbols) > 5 else ''} | Strategy: {strategy_name} | Total Risk: {risk}% | 5-min candles | 15s checks | 30s cooldown per pair"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/current-price', methods=['GET'])
def get_current_price():
    """Get current price for a symbol"""
    # FIXED: No default fallback to BTC/USDT - require symbol parameter
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({'error': 'Symbol parameter is required'}), 400

    trading_mode = request.args.get('trading_mode', 'spot')

    try:
        temp_interface = TradingInterface('', '', 'binance', False, trading_mode)
        df = temp_interface.fetch_ohlcv(symbol, '1m', 1)
        current_price = float(df['close'].iloc[-1])

        return jsonify({
            'symbol': symbol,
            'price': current_price,
            'timestamp': int(time.time() * 1000),
            'trading_mode': trading_mode
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
    symbol = data.get('symbol')
    if not symbol:
        return jsonify({"error": "Trading pair (symbol) is required"}), 400

    real_mode = data.get('real_mode', False)
    risk = float(data.get('risk', 1.0))
    stop_loss = float(data.get('stop_loss', 1.0))
    take_profit = float(data.get('take_profit', 2.0))
    strategy_type = data.get('strategy_type', 'default_ma')
    trade_amount = data.get('trade_amount')

    # NEW: Multi-pair mode detection
    multi_pair_mode = data.get('multi_pair_mode', False)
    symbols = data.get('symbols', [symbol])  # List of symbols for multi-pair

    trading_mode = data.get('trading_mode', 'spot')
    leverage = int(data.get('leverage', 1))
    kill_switch_threshold = int(data.get('kill_switch_threshold', 10))

    db_mode = 'live' if real_mode else 'paper'
    set_trading_mode(db_mode)

    if bot_running:
        return jsonify({"error": "Bot is already running"}), 400

    try:
        current_interface = TradingInterface(
            api_key, api_secret, exchange, real_mode, trading_mode, leverage
        )

        # Choose bot type based on mode
        if multi_pair_mode and len(symbols) > 1:
            current_bot = MultiPairTradingBot(
                current_interface,
                symbols,  # Pass list of symbols
                risk,
                stop_loss,
                take_profit,
                strategy_type=strategy_type,
                trade_amount=trade_amount,
                kill_switch_threshold=kill_switch_threshold
            )
            bot_type = "Multi-Pair"
            symbol_info = f"{len(symbols)} pairs: {', '.join(symbols[:3])}" + ("..." if len(symbols) > 3 else "")
        else:
            current_bot = TradingBot(
                current_interface,
                symbol,  # Single symbol
                risk,
                stop_loss,
                take_profit,
                strategy_type=strategy_type,
                trade_amount=trade_amount,
                kill_switch_threshold=kill_switch_threshold
            )
            bot_type = "Single-Pair"
            symbol_info = symbol

        def run_bot():
            global bot_running
            while bot_running:
                try:
                    current_bot.run_once()

                    if current_bot.is_kill_switch_active():
                        print("Kill switch triggered - stopping bot automatically")
                        bot_running = False
                        break

                    time.sleep(10)
                except Exception as e:
                    print(f"Bot error: {e}")
                    time.sleep(10)

        bot_running = True
        bot_thread = threading.Thread(target=run_bot)
        bot_thread.daemon = True
        bot_thread.start()

        strategy_name = "Custom Strategy" if strategy_type == "custom" else "Default MA Crossover"
        trade_info = f" with ${trade_amount} per trade" if trade_amount else " with balance-based sizing"

        mode_info = f" in {trading_mode.upper()} mode"
        if trading_mode == "futures" and leverage > 1:
            mode_info += f" (Leverage: {leverage}x)"

        db_info = f" | Database: {db_mode.upper()}"
        kill_switch_info = f" | Kill Switch: {kill_switch_threshold} losses"

        return jsonify({
            "message": f"{bot_type} Bot started successfully trading {symbol_info} using {strategy_name}{trade_info}{mode_info}{db_info}{kill_switch_info}"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/stop', methods=['POST'])
def stop_bot():
    global bot_running
    bot_running = False
    return jsonify({"message": "Bot stopped"})

@app.route('/api/status', methods=['GET'])
def bot_status():
    global current_bot
    status = {
        "running": bot_running,
        "trading_mode": get_trading_mode()
    }

    # NEW: Add kill switch status info
    if current_bot:
        status.update({
            "kill_switch_active": current_bot.is_kill_switch_active(),
            "consecutive_losses": current_bot.consecutive_losses,
            "kill_switch_threshold": current_bot.kill_switch_threshold,
            "kill_switch_reason": getattr(current_bot, 'kill_switch_reason', '')
        })

    return jsonify(status)

# NEW: Kill switch control endpoints
@app.route('/api/kill-switch-status', methods=['GET'])
def get_kill_switch_status():
    """Get current kill switch status"""
    global current_bot

    if not current_bot:
        return jsonify({'error': 'Bot not running'}), 400

    return jsonify({
        'active': current_bot.is_kill_switch_active(),
        'consecutive_losses': current_bot.consecutive_losses,
        'threshold': current_bot.kill_switch_threshold,
        'reason': getattr(current_bot, 'kill_switch_reason', '')
    })

@app.route('/api/reset-kill-switch', methods=['POST'])
def reset_kill_switch():
    """Manually reset the kill switch to resume trading"""
    global current_bot

    if not current_bot:
        return jsonify({'error': 'Bot not running'}), 400

    current_bot.reset_kill_switch()
    return jsonify({'message': 'Kill switch reset - trading can resume'})

# Fixed current-position endpoint
@app.route('/api/current-position', methods=['GET'])
def get_current_position():
    """Return the bot's current trading position"""
    global current_bot

    try:
        if not current_bot:
            return jsonify({'error': 'Bot not running'}), 400

        # Safely get position attributes with default values
        position = {
            'symbol': getattr(current_bot, 'symbol', 'Unknown'),
            'side': getattr(current_bot, 'current_side', None) or getattr(current_bot, 'position_side', None),
            'entry_price': getattr(current_bot, 'entry_price', None) or getattr(current_bot, 'current_price', None),
            'amount': getattr(current_bot, 'trade_amount', None) or getattr(current_bot, 'position_size', None),
            'status': 'active' if hasattr(current_bot, 'in_position') and current_bot.in_position else 'no_position'
        }

        # Additional safety checks
        if position['side'] is None:
            position['side'] = 'none'
        if position['amount'] is None:
            position['amount'] = 0

        return jsonify(position)

    except Exception as e:
        print(f"Error getting current position: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/test-connection', methods=['POST'])
def test_binance_connection():
    """Test if API keys can connect to the selected exchange"""
    data = request.get_json()
    api_key = data.get('api_key', '')
    api_secret = data.get('api_secret', '')
    exchange = data.get('exchange', 'binance')

    if not api_key or not api_secret:
        return jsonify({"error": "API key and secret required"}), 400

    try:
        # Test connection without trading, using the selected exchange
        test_interface = TradingInterface(api_key, api_secret, exchange, True)

        # Try to fetch account balance (doesn't cost money)
        balance = test_interface.get_balance('USDT')

        # Try to fetch current price (doesn't cost money) - FIXED: Use BTC/USDT only for connection test
        df = test_interface.fetch_ohlcv('BTC/USDT', '1m', 1)
        current_price = float(df['close'].iloc[-1])

        return jsonify({
            "success": True,
            "message": f"API keys work! Connected to {exchange.capitalize()} successfully",
            "your_usdt_balance": balance['free'],
            "current_btc_price": current_price
        })
    except Exception as e:
        return jsonify({
            "error": f"API connection failed: {str(e)}"
        }), 500

@app.route('/api/backtest', methods=['POST'])
def backtest():
    data = request.get_json()
    # FIXED: No default fallback - require symbol to be provided
    symbol = data.get('symbol')
    if not symbol:
        return jsonify({'error': 'Symbol parameter is required'}), 400

    years = int(data.get('years', 2))
    risk = float(data.get('risk', 1.0))
    stop_loss = float(data.get('stop_loss', 1.0))
    take_profit = float(data.get('take_profit', 2.0))

    results = run_backtest(symbol, years, risk, stop_loss, take_profit)
    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
