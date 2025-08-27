import ccxt
import pandas as pd
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TradingInterface:
    def __init__(self, api_key, api_secret, exchange_name, real_mode=False, trading_mode="spot", leverage=1):
        self.real_mode = real_mode
        self.trading_mode = trading_mode  # "spot" or "futures"
        self.leverage = leverage
        self.exchange_name = exchange_name

        exchange_class = getattr(ccxt, exchange_name)

        # Configure exchange parameters
        params = {}
        if real_mode and api_key and api_secret:
            params = {
                'apiKey': api_key,
                'secret': api_secret,
                'sandbox': False,  # Use live environment for real mode
                'enableRateLimit': True  # Enable built-in rate limiting
            }
        else:
            # For paper trading or when no API keys provided
            params = {
                'sandbox': True,  # Use sandbox if available
                'enableRateLimit': True
            }

        # Configure for spot or futures
        if trading_mode == "futures":
            params['options'] = {'defaultType': 'future'}

        try:
            self.exchange = exchange_class(params)
            # Load markets with error handling
            self.markets = self._load_markets_with_retry()
            logger.info(f"Successfully initialized {exchange_name} exchange in {trading_mode} mode")
        except Exception as e:
            logger.error(f"Failed to initialize exchange {exchange_name}: {str(e)}")
            raise

        # Set leverage for futures if in real mode
        if trading_mode == "futures" and real_mode and leverage > 1:
            try:
                # Note: Leverage will be set per symbol when placing orders
                logger.info(f"Futures mode enabled with {leverage}x leverage")
            except Exception as e:
                logger.warning(f"Leverage setup note: {e}")

    def _load_markets_with_retry(self, max_retries=3):
        """Load markets with retry logic"""
        for attempt in range(max_retries):
            try:
                return self.exchange.load_markets()
            except Exception as e:
                if attempt == max_retries - 1:
                    raise e
                logger.warning(f"Market loading attempt {attempt + 1} failed: {e}. Retrying...")
                time.sleep(2)

    def format_symbol_for_mode(self, symbol):
        """Convert symbol format based on trading mode"""
        try:
            if self.trading_mode == "futures":
                # Convert BTC/USDT to BTC/USDT:USDT for futures
                if ':' not in symbol:
                    base, quote = symbol.split('/')
                    formatted = f"{base}/{quote}:{quote}"
                    logger.debug(f"Formatted futures symbol: {symbol} -> {formatted}")
                    return formatted
            else:
                # Keep spot format - remove :USDT suffix if present
                if ':' in symbol:
                    formatted = symbol.split(':')[0]
                    logger.debug(f"Formatted spot symbol: {symbol} -> {formatted}")
                    return formatted

            return symbol
        except Exception as e:
            logger.error(f"Error formatting symbol {symbol}: {e}")
            return symbol

    def validate_symbol(self, symbol):
        """Validate if symbol exists in markets"""
        try:
            formatted_symbol = self.format_symbol_for_mode(symbol)
            if formatted_symbol not in self.markets:
                available_symbols = [s for s in self.markets.keys() if 'USDT' in s][:10]
                logger.error(f"Symbol {formatted_symbol} not found. Available: {available_symbols}")
                return False
            return True
        except Exception as e:
            logger.error(f"Error validating symbol {symbol}: {e}")
            return False

    def set_leverage_for_symbol(self, symbol):
        """Set leverage for a specific futures symbol"""
        if self.trading_mode == "futures" and self.real_mode and self.leverage > 1:
            try:
                formatted_symbol = self.format_symbol_for_mode(symbol)
                result = self.exchange.set_leverage(self.leverage, formatted_symbol)
                logger.info(f"Set leverage {self.leverage}x for {formatted_symbol}")
                return result
            except Exception as e:
                logger.warning(f"Leverage setting error for {symbol}: {e}")
                return None

    def fetch_ohlcv(self, symbol, timeframe='1h', limit=100, max_retries=3):
        """Fetch OHLCV data with improved error handling and retry logic"""
        formatted_symbol = self.format_symbol_for_mode(symbol)

        # Validate symbol first
        if not self.validate_symbol(symbol):
            raise ValueError(f"Invalid symbol: {symbol}")

        for attempt in range(max_retries):
            try:
                logger.debug(f"Fetching OHLCV: {formatted_symbol}, {timeframe}, limit={limit}")

                bars = self.exchange.fetch_ohlcv(formatted_symbol, timeframe=timeframe, limit=limit)

                if not bars:
                    raise ValueError(f"No data returned for {formatted_symbol}")

                df = pd.DataFrame(bars, columns=["timestamp","open","high","low","close","volume"])
                df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')

                logger.info(f"Successfully fetched {len(df)} candles for {formatted_symbol}")
                return df

            except ccxt.NetworkError as e:
                if attempt == max_retries - 1:
                    logger.error(f"Network error after {max_retries} attempts: {e}")
                    raise
                logger.warning(f"Network error on attempt {attempt + 1}: {e}. Retrying...")
                time.sleep(2 ** attempt)  # Exponential backoff

            except ccxt.ExchangeError as e:
                if "symbol" in str(e).lower():
                    logger.error(f"Symbol error for {formatted_symbol}: {e}")
                    raise ValueError(f"Invalid symbol {symbol}: {e}")
                elif attempt == max_retries - 1:
                    logger.error(f"Exchange error after {max_retries} attempts: {e}")
                    raise
                logger.warning(f"Exchange error on attempt {attempt + 1}: {e}. Retrying...")
                time.sleep(1)

            except Exception as e:
                if attempt == max_retries - 1:
                    logger.error(f"Unexpected error after {max_retries} attempts: {e}")
                    raise
                logger.warning(f"Unexpected error on attempt {attempt + 1}: {e}. Retrying...")
                time.sleep(1)

    def get_balance(self, currency="USDT"):
        """Get balance with error handling"""
        try:
            if not self.real_mode:
                # Return mock balance for paper trading
                return {
                    'free': 10000.0,
                    'used': 0.0,
                    'total': 10000.0
                }

            balance = self.exchange.fetch_balance()
            if currency in balance:
                return balance[currency]
            else:
                logger.warning(f"Currency {currency} not found in balance")
                return {'free': 0.0, 'used': 0.0, 'total': 0.0}

        except Exception as e:
            logger.error(f"Error fetching balance: {e}")
            if not self.real_mode:
                return {'free': 10000.0, 'used': 0.0, 'total': 10000.0}
            raise

    def place_order(self, symbol, side, amount, price=None, params={}):
        """Place order with enhanced error handling"""
        formatted_symbol = self.format_symbol_for_mode(symbol)

        if not self.real_mode:
            # Enhanced simulated paper trade
            try:
                # Get current price for simulation
                df = self.fetch_ohlcv(symbol, '1m', 1)
                current_price = float(df['close'].iloc[-1])
                simulated_price = price if price else current_price

                return {
                    'status': 'simulated',
                    'symbol': formatted_symbol,
                    'side': side,
                    'amount': amount,
                    'price': simulated_price,
                    'id': f'sim_{int(time.time())}'
                }
            except Exception as e:
                logger.warning(f"Error in paper trade simulation: {e}")
                return {
                    'status': 'simulated',
                    'symbol': formatted_symbol,
                    'side': side,
                    'amount': amount,
                    'price': price or 0,
                    'id': f'sim_{int(time.time())}'
                }

        # Validate symbol before placing real order
        if not self.validate_symbol(symbol):
            raise ValueError(f"Cannot place order: Invalid symbol {symbol}")

        # Set leverage before placing order (futures only)
        if self.trading_mode == "futures":
            self.set_leverage_for_symbol(symbol)

        try:
            if price:
                logger.info(f"Placing limit order: {side} {amount} {formatted_symbol} at {price}")
                return self.exchange.create_limit_order(formatted_symbol, side, amount, price, params)
            else:
                logger.info(f"Placing market order: {side} {amount} {formatted_symbol}")
                return self.exchange.create_market_order(formatted_symbol, side, amount, params)

        except ccxt.InsufficientFunds as e:
            logger.error(f"Insufficient funds: {e}")
            raise
        except ccxt.InvalidOrder as e:
            logger.error(f"Invalid order: {e}")
            raise
        except Exception as e:
            logger.error(f"Order placement error: {e}")
            raise

    def get_current_price(self, symbol):
        """Get current price for a symbol"""
        try:
            df = self.fetch_ohlcv(symbol, '1m', 1)
            return float(df['close'].iloc[-1])
        except Exception as e:
            logger.error(f"Error getting current price for {symbol}: {e}")
            raise

    def get_available_symbols(self, quote_currency='USDT', limit=20):
        """Get list of available trading symbols"""
        try:
            available = []
            for symbol in self.markets:
                if quote_currency in symbol and '/' in symbol:
                    available.append(symbol)
                if len(available) >= limit:
                    break
            return available
        except Exception as e:
            logger.error(f"Error getting available symbols: {e}")
            return ['BTC/USDT', 'ETH/USDT', 'ADA/USDT']  # Fallback

    def test_connection(self):
        """Test exchange connection"""
        try:
            # Try to fetch a simple ticker
            self.fetch_ohlcv('BTC/USDT', '1m', 1)
            logger.info("Exchange connection test successful")
            return True
        except Exception as e:
            logger.error(f"Exchange connection test failed: {e}")
            return False
