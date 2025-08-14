import ccxt
import pandas as pd

class TradingInterface:
    def __init__(self, api_key, api_secret, exchange_name, real_mode=False):
        self.real_mode = real_mode
        exchange_class = getattr(ccxt, exchange_name)
        params = {'apiKey': api_key, 'secret': api_secret}
        self.exchange = exchange_class(params) if real_mode else exchange_class()
        self.markets = self.exchange.load_markets()

    def fetch_ohlcv(self, symbol, timeframe='1h', limit=100):
        bars = self.exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
        df = pd.DataFrame(bars, columns=["timestamp","open","high","low","close","volume"])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        return df

    def get_balance(self, currency="USDT"):
        return self.exchange.fetch_balance()[currency]

    def place_order(self, symbol, side, amount, price=None, params={}):
        if not self.real_mode:
            # Simulated paper trade
            return {'status':'simulated', 'symbol':symbol, 'side':side, 'amount':amount}
        if price:
            return self.exchange.create_limit_order(symbol, side, amount, price, params)
        else:
            return self.exchange.create_market_order(symbol, side, amount, params)
