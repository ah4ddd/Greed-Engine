import ccxt
import pandas as pd

class TradingInterface:
    def __init__(self, api_key, api_secret, exchange_name, real_mode=False, trading_mode="spot", leverage=1):
        self.real_mode = real_mode
        self.trading_mode = trading_mode  # "spot" or "futures"
        self.leverage = leverage

        exchange_class = getattr(ccxt, exchange_name)
        params = {'apiKey': api_key, 'secret': api_secret} if real_mode else {}

        # Configure for spot or futures
        if trading_mode == "futures":
            params['options'] = {'defaultType': 'future'}

        self.exchange = exchange_class(params)
        self.markets = self.exchange.load_markets()

        # Set leverage for futures if in real mode
        if trading_mode == "futures" and real_mode and leverage > 1:
            try:
                # Note: Leverage will be set per symbol when placing orders
                pass
            except Exception as e:
                print(f"Leverage setup note: {e}")

    def format_symbol_for_mode(self, symbol):
        """Convert symbol format based on trading mode"""
        if self.trading_mode == "futures":
            # Convert BTC/USDT to BTC/USDT:USDT for futures
            if ':' not in symbol:
                return f"{symbol}:USDT"
        else:
            # Keep spot format
            if ':' in symbol:
                return symbol.split(':')[0]
        return symbol

    def set_leverage_for_symbol(self, symbol):
        """Set leverage for a specific futures symbol"""
        if self.trading_mode == "futures" and self.real_mode and self.leverage > 1:
            try:
                formatted_symbol = self.format_symbol_for_mode(symbol)
                return self.exchange.set_leverage(self.leverage, formatted_symbol)
            except Exception as e:
                print(f"Leverage setting error: {e}")
                return None

    def fetch_ohlcv(self, symbol, timeframe='1h', limit=100):
        formatted_symbol = self.format_symbol_for_mode(symbol)
        bars = self.exchange.fetch_ohlcv(formatted_symbol, timeframe=timeframe, limit=limit)
        df = pd.DataFrame(bars, columns=["timestamp","open","high","low","close","volume"])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        return df

    def get_balance(self, currency="USDT"):
        return self.exchange.fetch_balance()[currency]

    def place_order(self, symbol, side, amount, price=None, params={}):
        formatted_symbol = self.format_symbol_for_mode(symbol)

        if not self.real_mode:
            # Simulated paper trade
            return {'status':'simulated', 'symbol':formatted_symbol, 'side':side, 'amount':amount}

        # Set leverage before placing order (futures only)
        if self.trading_mode == "futures":
            self.set_leverage_for_symbol(symbol)

        if price:
            return self.exchange.create_limit_order(formatted_symbol, side, amount, price, params)
        else:
            return self.exchange.create_market_order(formatted_symbol, side, amount, params)
