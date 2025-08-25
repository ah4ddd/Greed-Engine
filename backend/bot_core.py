from backend.strategy import get_strategy_signal, get_fast_strategy_signal
from backend.risk import calculate_position_size, calculate_custom_position_size
from backend.db import log_trade, get_balance_db
import time

class TradingBot:
    """Single-pair trading bot - keeps existing API compatibility"""
    def __init__(self, interface, symbol, risk, stop_loss, take_profit, strategy_type="default_ma", trade_amount=None, kill_switch_threshold=10):
        self.iface = interface
        self.symbol = symbol
        self.risk = risk
        self.stop_loss = stop_loss
        self.take_profit = take_profit
        self.strategy_type = strategy_type
        self.trade_amount = trade_amount
        self.last_trade_time = 0
        self.trade_count = 0

        # Kill Switch Protection
        self.consecutive_losses = 0
        self.kill_switch_threshold = kill_switch_threshold
        self.kill_switch_triggered = False
        self.kill_switch_reason = ""

        # Track open positions
        self.open_positions = []

    def check_kill_switch(self, pnl):
        if pnl < 0:
            self.consecutive_losses += 1
            if self.consecutive_losses >= self.kill_switch_threshold:
                self.kill_switch_triggered = True
                self.kill_switch_reason = f"KILL SWITCH ACTIVATED: {self.consecutive_losses} consecutive losses"
                print(f"\n🛑 {self.kill_switch_reason}")
                return True
        else:
            if self.consecutive_losses > 0:
                print(f"✅ Loss streak broken! Was {self.consecutive_losses} consecutive losses")
            self.consecutive_losses = 0
        return False

    def is_kill_switch_active(self):
        return self.kill_switch_triggered

    def reset_kill_switch(self):
        self.kill_switch_triggered = False
        self.consecutive_losses = 0
        self.kill_switch_reason = ""
        print("🔥 Kill switch manually reset - trading can resume")

    def calculate_realistic_pnl(self, entry_price, current_price, side, position_size):
        if side == "buy":
            price_change = current_price - entry_price
        else:
            price_change = entry_price - current_price
        return price_change * position_size

    def should_close_position(self, position, current_price):
        entry_price = position['entry_price']
        side = position['side']

        if side == "buy":
            stop_loss_price = entry_price * (1 - self.stop_loss / 100)
            take_profit_price = entry_price * (1 + self.take_profit / 100)

            if current_price <= stop_loss_price:
                return True, "stop_loss"
            elif current_price >= take_profit_price:
                return True, "take_profit"
        else:
            stop_loss_price = entry_price * (1 + self.stop_loss / 100)
            take_profit_price = entry_price * (1 - self.take_profit / 100)

            if current_price >= stop_loss_price:
                return True, "stop_loss"
            elif current_price <= take_profit_price:
                return True, "take_profit"

        return False, None

    def run_once(self):
        try:
            if self.kill_switch_triggered:
                print(f"🛑 Trading halted: {self.kill_switch_reason}")
                return

            df = self.iface.fetch_ohlcv(self.symbol)
            if df.empty:
                return

            current_price = float(df["close"].iloc[-1])
            current_time = time.time()

            # Check and close existing positions
            positions_to_remove = []
            for i, position in enumerate(self.open_positions):
                should_close, reason = self.should_close_position(position, current_price)

                if should_close:
                    pnl = self.calculate_realistic_pnl(
                        position['entry_price'],
                        current_price,
                        position['side'],
                        position['position_size']
                    )

                    if self.check_kill_switch(pnl):
                        return

                    trading_mode = getattr(self.iface, 'trading_mode', 'spot').upper()
                    leverage = getattr(self.iface, 'leverage', 1)

                    try:
                        log_trade(
                            self.symbol,
                            f"close_{position['side']}",
                            position['position_size'],
                            current_price,
                            self.stop_loss,
                            self.take_profit,
                            "EXECUTED",
                            pnl,
                            trading_mode,
                            leverage,
                            position['usd_amount']
                        )
                    except Exception as db_error:
                        print(f"Database logging error: {db_error}")

                    pnl_sign = "+" if pnl >= 0 else ""
                    print(f"📈 CLOSE #{position['trade_id']}: {reason.upper()} - P&L: {pnl_sign}${pnl:.2f}")
                    positions_to_remove.append(i)

            # Remove closed positions
            for i in reversed(positions_to_remove):
                del self.open_positions[i]

            # Limit concurrent positions
            if len(self.open_positions) >= 3:
                return

            # Get strategy signal
            action = get_strategy_signal(df, self.strategy_type)

            # Only trade on actual signals with cooldown
            if action in ["buy", "sell"] and current_time - self.last_trade_time > 300:
                balance = get_balance_db()

                if self.trade_amount:
                    pos_size = calculate_custom_position_size(self.trade_amount, current_price, self.stop_loss)
                    display_usd_amount = self.trade_amount
                else:
                    pos_size = calculate_position_size(balance, self.risk, current_price, self.stop_loss)
                    display_usd_amount = pos_size * current_price

                if pos_size < 0.001:
                    pos_size = 0.001

                order = self.iface.place_order(self.symbol, action, pos_size)
                self.last_trade_time = current_time
                self.trade_count += 1

                position = {
                    'trade_id': self.trade_count,
                    'side': action,
                    'entry_price': current_price,
                    'position_size': pos_size,
                    'usd_amount': display_usd_amount,
                    'timestamp': current_time
                }
                self.open_positions.append(position)

                trading_mode = getattr(self.iface, 'trading_mode', 'spot').upper()
                leverage = getattr(self.iface, 'leverage', 1)
                strategy_name = "CUSTOM" if self.strategy_type == "custom" else "DEFAULT MA"

                if trading_mode == "FUTURES" and leverage > 1:
                    strategy_display = f"{strategy_name}-FUTURES-{leverage}X"
                    mode_emoji = "🚀"
                else:
                    strategy_display = f"{strategy_name}-SPOT"
                    mode_emoji = "📊"

                print(f"{mode_emoji} OPEN #{self.trade_count} [{strategy_display}]: "
                      f"{action.upper()} ${display_usd_amount:.2f} {self.symbol} at ${current_price:.2f}")

        except Exception as e:
            print(f"Bot error: {e}")


class MultiPairTradingBot:
    """Multi-pair trading bot for increased trade frequency"""
    def __init__(self, interface, symbols, risk, stop_loss, take_profit, strategy_type="default_ma", trade_amount=None, kill_switch_threshold=10):
        self.iface = interface
        self.symbols = symbols if isinstance(symbols, list) else [symbols]
        self.risk = risk / len(self.symbols)  # Split risk across pairs
        self.stop_loss = stop_loss
        self.take_profit = take_profit
        self.strategy_type = strategy_type
        self.trade_amount = trade_amount
        self.kill_switch_threshold = kill_switch_threshold

        # Track data per symbol
        self.last_trade_times = {symbol: 0 for symbol in self.symbols}
        self.open_positions = []
        self.total_trade_count = 0

        # Kill switch (global across all pairs)
        self.consecutive_losses = 0
        self.kill_switch_triggered = False
        self.kill_switch_reason = ""

    def check_kill_switch(self, pnl):
        if pnl < 0:
            self.consecutive_losses += 1
            if self.consecutive_losses >= self.kill_switch_threshold:
                self.kill_switch_triggered = True
                self.kill_switch_reason = f"KILL SWITCH: {self.consecutive_losses} consecutive losses"
                print(f"\n🛑 {self.kill_switch_reason}")
                return True
        else:
            if self.consecutive_losses > 0:
                print(f"✅ Loss streak broken! Was {self.consecutive_losses} consecutive losses")
            self.consecutive_losses = 0
        return False

    def is_kill_switch_active(self):
        return self.kill_switch_triggered

    def reset_kill_switch(self):
        self.kill_switch_triggered = False
        self.consecutive_losses = 0
        self.kill_switch_reason = ""
        print("🔥 Kill switch reset - multi-pair trading can resume")

    def calculate_realistic_pnl(self, entry_price, current_price, side, position_size):
        if side == "buy":
            price_change = current_price - entry_price
        else:
            price_change = entry_price - current_price
        return price_change * position_size

    def should_close_position(self, position, current_price):
        entry_price = position['entry_price']
        side = position['side']

        if side == "buy":
            stop_loss_price = entry_price * (1 - self.stop_loss / 100)
            take_profit_price = entry_price * (1 + self.take_profit / 100)

            if current_price <= stop_loss_price:
                return True, "stop_loss"
            elif current_price >= take_profit_price:
                return True, "take_profit"
        else:
            stop_loss_price = entry_price * (1 + self.stop_loss / 100)
            take_profit_price = entry_price * (1 - self.take_profit / 100)

            if current_price >= stop_loss_price:
                return True, "stop_loss"
            elif current_price <= take_profit_price:
                return True, "take_profit"

        return False, None

    def run_once(self):
        try:
            if self.kill_switch_triggered:
                print(f"🛑 Multi-pair trading halted: {self.kill_switch_reason}")
                return

            current_time = time.time()

            # Check existing positions for ALL symbols
            positions_to_remove = []
            for i, position in enumerate(self.open_positions):
                symbol = position['symbol']

                try:
                    df = self.iface.fetch_ohlcv(symbol)
                    if df.empty:
                        continue

                    current_price = float(df["close"].iloc[-1])
                    should_close, reason = self.should_close_position(position, current_price)

                    if should_close:
                        pnl = self.calculate_realistic_pnl(
                            position['entry_price'],
                            current_price,
                            position['side'],
                            position['position_size']
                        )

                        if self.check_kill_switch(pnl):
                            return

                        trading_mode = getattr(self.iface, 'trading_mode', 'spot').upper()
                        leverage = getattr(self.iface, 'leverage', 1)

                        try:
                            log_trade(
                                symbol,
                                f"close_{position['side']}",
                                position['position_size'],
                                current_price,
                                self.stop_loss,
                                self.take_profit,
                                "EXECUTED",
                                pnl,
                                trading_mode,
                                leverage,
                                position['usd_amount']
                            )
                        except Exception as db_error:
                            print(f"Database error: {db_error}")

                        pnl_sign = "+" if pnl >= 0 else ""
                        print(f"📈 CLOSE {symbol} #{position['trade_id']}: {reason.upper()} - P&L: {pnl_sign}${pnl:.2f}")
                        positions_to_remove.append(i)

                except Exception as e:
                    print(f"Error processing {symbol}: {e}")
                    continue

            # Remove closed positions
            for i in reversed(positions_to_remove):
                del self.open_positions[i]

            # Check for new trades across ALL symbols
            for symbol in self.symbols:
                try:
                    # Limit positions per symbol
                    symbol_positions = [p for p in self.open_positions if p['symbol'] == symbol]
                    if len(symbol_positions) >= 2:
                        continue

                    # Check cooldown for this specific symbol
                    if current_time - self.last_trade_times[symbol] < 300:
                        continue

                    df = self.iface.fetch_ohlcv(symbol)
                    if df.empty:
                        continue

                    action = get_strategy_signal(df, self.strategy_type)

                    if action in ["buy", "sell"]:
                        balance = get_balance_db()
                        current_price = float(df["close"].iloc[-1])

                        if self.trade_amount:
                            pos_size = calculate_custom_position_size(self.trade_amount, current_price, self.stop_loss)
                            display_usd_amount = self.trade_amount
                        else:
                            pos_size = calculate_position_size(balance, self.risk, current_price, self.stop_loss)
                            display_usd_amount = pos_size * current_price

                        if pos_size < 0.001:
                            pos_size = 0.001

                        order = self.iface.place_order(symbol, action, pos_size)
                        self.last_trade_times[symbol] = current_time
                        self.total_trade_count += 1

                        position = {
                            'trade_id': self.total_trade_count,
                            'symbol': symbol,
                            'side': action,
                            'entry_price': current_price,
                            'position_size': pos_size,
                            'usd_amount': display_usd_amount,
                            'timestamp': current_time
                        }
                        self.open_positions.append(position)

                        trading_mode = getattr(self.iface, 'trading_mode', 'spot').upper()
                        print(f"📊 OPEN {symbol} #{self.total_trade_count}: "
                              f"{action.upper()} ${display_usd_amount:.2f} at ${current_price:.2f} "
                              f"| Open positions: {len(self.open_positions)}")

                except Exception as e:
                    print(f"Error trading {symbol}: {e}")
                    continue

        except Exception as e:
            print(f"Multi-pair bot error: {e}")


# NEW HIGH-FREQUENCY AGGRESSIVE BOT CLASS ADDED BELOW

class HighFrequencyTradingBot:
    """
    AGGRESSIVE HIGH-FREQUENCY BOT
    - 5-minute candles instead of 1-hour
    - 30-second cooldowns instead of 5-minute
    - Simpler strategy logic
    - More position size flexibility
    """
    def __init__(self, interface, symbol, risk, stop_loss, take_profit, strategy_type="aggressive_ema", trade_amount=None, kill_switch_threshold=15):
        self.iface = interface
        self.symbol = symbol
        self.risk = min(risk * 1.5, 3.0)  # Increase risk appetite up to 3%
        self.stop_loss = max(stop_loss, 1.5)  # Minimum 1.5% stop loss
        self.take_profit = max(take_profit, 2.0)  # Minimum 2% take profit
        self.strategy_type = strategy_type
        self.trade_amount = trade_amount
        self.last_trade_time = 0
        self.trade_count = 0

        # More aggressive kill switch
        self.consecutive_losses = 0
        self.kill_switch_threshold = kill_switch_threshold  # Allow more losses before stopping
        self.kill_switch_triggered = False
        self.kill_switch_reason = ""

        # Track open positions (allow up to 3 concurrent)
        self.open_positions = []

        # Performance tracking
        self.total_pnl = 0
        self.win_count = 0
        self.loss_count = 0

    def check_kill_switch(self, pnl):
        """More lenient kill switch for aggressive trading"""
        if pnl < 0:
            self.consecutive_losses += 1
            # Only trigger after significant losses AND poor performance
            if self.consecutive_losses >= self.kill_switch_threshold:
                # Additional check: total PnL must be significantly negative
                if self.total_pnl < -100:  # More than $100 loss
                    self.kill_switch_triggered = True
                    self.kill_switch_reason = f"KILL SWITCH: {self.consecutive_losses} losses, Total PnL: ${self.total_pnl:.2f}"
                    print(f"\n🛑 {self.kill_switch_reason}")
                    return True
        else:
            self.win_count += 1
            if self.consecutive_losses > 0:
                print(f"✅ Loss streak broken! Was {self.consecutive_losses} losses")
            self.consecutive_losses = 0
        return False

    def is_kill_switch_active(self):
        return self.kill_switch_triggered

    def reset_kill_switch(self):
        self.kill_switch_triggered = False
        self.consecutive_losses = 0
        self.kill_switch_reason = ""
        print("🔥 Kill switch reset - aggressive trading resumed")

    def calculate_realistic_pnl(self, entry_price, current_price, side, position_size):
        """Enhanced PnL calculation with fees"""
        if side == "buy":
            price_change = current_price - entry_price
        else:
            price_change = entry_price - current_price

        # Subtract approximate trading fees (0.1% each way = 0.2% total)
        gross_pnl = price_change * position_size
        fee_cost = (entry_price + current_price) * position_size * 0.001  # 0.1% fee approximation
        net_pnl = gross_pnl - fee_cost

        return net_pnl

    def should_close_position(self, position, current_price):
        """More aggressive position closing"""
        entry_price = position['entry_price']
        side = position['side']

        # Dynamic stop loss based on volatility
        dynamic_stop = self.stop_loss
        dynamic_take = self.take_profit

        # If we're in profit, use trailing stop
        current_pnl = self.calculate_realistic_pnl(entry_price, current_price, side, position['position_size'])

        if side == "buy":
            stop_loss_price = entry_price * (1 - dynamic_stop / 100)
            take_profit_price = entry_price * (1 + dynamic_take / 100)

            if current_price <= stop_loss_price:
                return True, "stop_loss"
            elif current_price >= take_profit_price:
                return True, "take_profit"

        else:  # sell position
            stop_loss_price = entry_price * (1 + dynamic_stop / 100)
            take_profit_price = entry_price * (1 - dynamic_take / 100)

            if current_price >= stop_loss_price:
                return True, "stop_loss"
            elif current_price <= take_profit_price:
                return True, "take_profit"

        return False, None

    def run_once(self):
        """AGGRESSIVE EXECUTION LOOP"""
        try:
            if self.kill_switch_triggered:
                print(f"🛑 Trading halted: {self.kill_switch_reason}")
                return

            # Fetch 5-minute candles for faster signals
            df = self.iface.fetch_ohlcv(self.symbol, timeframe='5m', limit=50)
            if df.empty:
                print(f"⚠️ No data for {self.symbol}")
                return

            current_price = float(df["close"].iloc[-1])
            current_time = time.time()

            # Check existing positions first
            positions_to_remove = []
            for i, position in enumerate(self.open_positions):
                should_close, reason = self.should_close_position(position, current_price)

                if should_close:
                    pnl = self.calculate_realistic_pnl(
                        position['entry_price'],
                        current_price,
                        position['side'],
                        position['position_size']
                    )

                    self.total_pnl += pnl

                    if pnl > 0:
                        self.win_count += 1
                    else:
                        self.loss_count += 1

                    if self.check_kill_switch(pnl):
                        return

                    # Log to database
                    try:
                        trading_mode = getattr(self.iface, 'trading_mode', 'spot').upper()
                        leverage = getattr(self.iface, 'leverage', 1)

                        log_trade(
                            self.symbol,
                            f"close_{position['side']}",
                            position['position_size'],
                            current_price,
                            self.stop_loss,
                            self.take_profit,
                            "EXECUTED",
                            pnl,
                            trading_mode,
                            leverage,
                            position['usd_amount']
                        )
                    except Exception as db_error:
                        print(f"Database error: {db_error}")

                    # Enhanced logging
                    win_rate = (self.win_count / max(self.win_count + self.loss_count, 1)) * 100
                    pnl_sign = "+" if pnl >= 0 else ""
                    print(f"📈 CLOSE #{position['trade_id']}: {reason.upper()} - "
                          f"P&L: {pnl_sign}${pnl:.2f} | Total: ${self.total_pnl:.2f} | "
                          f"Win Rate: {win_rate:.1f}%")

                    positions_to_remove.append(i)

            # Remove closed positions
            for i in reversed(positions_to_remove):
                del self.open_positions[i]

            # Allow up to 3 concurrent positions for more action
            if len(self.open_positions) >= 3:
                return

            # Get aggressive strategy signal
            action = get_fast_strategy_signal(df, self.strategy_type)

            # AGGRESSIVE ENTRY CONDITIONS
            # Reduced cooldown to 30 seconds instead of 5 minutes
            if action in ["buy", "sell"] and current_time - self.last_trade_time > 30:
                balance = get_balance_db()

                # More aggressive position sizing
                if self.trade_amount:
                    pos_size = calculate_custom_position_size(self.trade_amount, current_price, self.stop_loss)
                    display_usd_amount = self.trade_amount
                else:
                    # Use higher risk percentage for more aggressive trading
                    pos_size = calculate_position_size(balance, self.risk, current_price, self.stop_loss)
                    display_usd_amount = pos_size * current_price

                # Minimum position size for meaningful trades
                if pos_size < 0.001:
                    pos_size = 0.001

                # Execute the trade
                try:
                    order = self.iface.place_order(self.symbol, action, pos_size)
                    self.last_trade_time = current_time
                    self.trade_count += 1

                    position = {
                        'trade_id': self.trade_count,
                        'side': action,
                        'entry_price': current_price,
                        'position_size': pos_size,
                        'usd_amount': display_usd_amount,
                        'timestamp': current_time
                    }
                    self.open_positions.append(position)

                    # Enhanced trade logging
                    trading_mode = getattr(self.iface, 'trading_mode', 'spot').upper()
                    leverage = getattr(self.iface, 'leverage', 1)
                    strategy_name = "AGGRESSIVE" if self.strategy_type == "aggressive_ema" else "BREAKOUT"

                    print(f"🚀 OPEN #{self.trade_count} [{strategy_name}-{trading_mode}]: "
                          f"{action.upper()} ${display_usd_amount:.2f} {self.symbol} at ${current_price:.2f} | "
                          f"Open: {len(self.open_positions)} | Total P&L: ${self.total_pnl:.2f}")

                except Exception as order_error:
                    print(f"Order execution error: {order_error}")

        except Exception as e:
            print(f"Bot execution error: {e}")

    def get_performance_stats(self):
        """Return current performance statistics"""
        total_trades = self.win_count + self.loss_count
        win_rate = (self.win_count / max(total_trades, 1)) * 100

        return {
            'total_pnl': self.total_pnl,
            'total_trades': total_trades,
            'win_count': self.win_count,
            'loss_count': self.loss_count,
            'win_rate': win_rate,
            'consecutive_losses': self.consecutive_losses,
            'open_positions': len(self.open_positions)
        }


# NEW SUPER AGGRESSIVE MULTI-PAIR BOT CLASS ADDED BELOW

class SuperAggressiveMultiPairBot:
    """
    SUPER AGGRESSIVE MULTI-PAIR HIGH-FREQUENCY BOT
    - Trades 5-15 pairs simultaneously
    - 5-minute candles with 15-second checks
    - 30-second cooldown per pair
    - Maximum trade frequency for maximum opportunities
    """
    def __init__(self, interface, symbols, risk, stop_loss, take_profit, strategy_type="aggressive_ema", trade_amount=None, kill_switch_threshold=20):
        self.iface = interface
        self.symbols = symbols if isinstance(symbols, list) else [symbols]
        # Split risk more aggressively - minimum 0.3% per pair
        self.risk_per_pair = max(risk / len(self.symbols), 0.3)
        self.stop_loss = max(stop_loss, 1.5)
        self.take_profit = max(take_profit, 2.0)
        self.strategy_type = strategy_type
        self.trade_amount = trade_amount
        self.kill_switch_threshold = kill_switch_threshold

        # Track per-symbol data
        self.last_trade_times = {symbol: 0 for symbol in self.symbols}
        self.open_positions = []
        self.total_trade_count = 0

        # Performance tracking
        self.total_pnl = 0
        self.win_count = 0
        self.loss_count = 0
        self.consecutive_losses = 0
        self.kill_switch_triggered = False
        self.kill_switch_reason = ""

        # Track per-pair performance
        self.pair_performance = {symbol: {'wins': 0, 'losses': 0, 'pnl': 0} for symbol in self.symbols}

    def check_kill_switch(self, pnl):
        """Multi-pair kill switch with total PnL consideration"""
        if pnl < 0:
            self.consecutive_losses += 1
            if self.consecutive_losses >= self.kill_switch_threshold:
                if self.total_pnl < -200:  # $200 total loss threshold
                    self.kill_switch_triggered = True
                    self.kill_switch_reason = f"SUPER BOT KILL SWITCH: {self.consecutive_losses} losses, Total: ${self.total_pnl:.2f}"
                    print(f"\n🛑 {self.kill_switch_reason}")
                    return True
        else:
            if self.consecutive_losses > 0:
                print(f"✅ Multi-pair loss streak broken! Was {self.consecutive_losses} losses")
            self.consecutive_losses = 0
        return False

    def is_kill_switch_active(self):
        return self.kill_switch_triggered

    def reset_kill_switch(self):
        self.kill_switch_triggered = False
        self.consecutive_losses = 0
        self.kill_switch_reason = ""
        print("🔥 Super aggressive multi-pair bot reset - maximum frequency resumed")

    def calculate_realistic_pnl(self, entry_price, current_price, side, position_size):
        """PnL calculation with trading fees"""
        if side == "buy":
            price_change = current_price - entry_price
        else:
            price_change = entry_price - current_price

        gross_pnl = price_change * position_size
        fee_cost = (entry_price + current_price) * position_size * 0.001
        return gross_pnl - fee_cost

    def should_close_position(self, position, current_price):
        """Aggressive position closing with dynamic levels"""
        entry_price = position['entry_price']
        side = position['side']

        if side == "buy":
            stop_loss_price = entry_price * (1 - self.stop_loss / 100)
            take_profit_price = entry_price * (1 + self.take_profit / 100)

            if current_price <= stop_loss_price:
                return True, "stop_loss"
            elif current_price >= take_profit_price:
                return True, "take_profit"
        else:
            stop_loss_price = entry_price * (1 + self.stop_loss / 100)
            take_profit_price = entry_price * (1 - self.take_profit / 100)

            if current_price >= stop_loss_price:
                return True, "stop_loss"
            elif current_price <= take_profit_price:
                return True, "take_profit"

        return False, None

    def run_once(self):
        """SUPER AGGRESSIVE MULTI-PAIR EXECUTION"""
        try:
            if self.kill_switch_triggered:
                print(f"🛑 Super aggressive multi-pair trading halted: {self.kill_switch_reason}")
                return

            current_time = time.time()

            # Process ALL open positions first
            positions_to_remove = []
            for i, position in enumerate(self.open_positions):
                symbol = position['symbol']

                try:
                    df = self.iface.fetch_ohlcv(symbol, timeframe='5m', limit=30)
                    if df.empty:
                        continue

                    current_price = float(df["close"].iloc[-1])
                    should_close, reason = self.should_close_position(position, current_price)

                    if should_close:
                        pnl = self.calculate_realistic_pnl(
                            position['entry_price'],
                            current_price,
                            position['side'],
                            position['position_size']
                        )

                        self.total_pnl += pnl

                        # Update pair performance
                        if pnl > 0:
                            self.win_count += 1
                            self.pair_performance[symbol]['wins'] += 1
                        else:
                            self.loss_count += 1
                            self.pair_performance[symbol]['losses'] += 1

                        self.pair_performance[symbol]['pnl'] += pnl

                        if self.check_kill_switch(pnl):
                            return

                        # Log trade
                        try:
                            trading_mode = getattr(self.iface, 'trading_mode', 'spot').upper()
                            leverage = getattr(self.iface, 'leverage', 1)

                            log_trade(
                                symbol,
                                f"close_{position['side']}",
                                position['position_size'],
                                current_price,
                                self.stop_loss,
                                self.take_profit,
                                "EXECUTED",
                                pnl,
                                trading_mode,
                                leverage,
                                position['usd_amount']
                            )
                        except Exception as db_error:
                            print(f"DB error: {db_error}")

                        # Enhanced multi-pair logging
                        total_trades = self.win_count + self.loss_count
                        win_rate = (self.win_count / max(total_trades, 1)) * 100
                        pair_win_rate = (self.pair_performance[symbol]['wins'] /
                                       max(self.pair_performance[symbol]['wins'] + self.pair_performance[symbol]['losses'], 1)) * 100

                        pnl_sign = "+" if pnl >= 0 else ""
                        print(f"📈 CLOSE {symbol} #{position['trade_id']}: {reason.upper()} - "
                              f"P&L: {pnl_sign}${pnl:.2f} | Total: ${self.total_pnl:.2f} | "
                              f"Win Rate: {win_rate:.1f}% | {symbol}: {pair_win_rate:.1f}%")

                        positions_to_remove.append(i)

                except Exception as e:
                    print(f"Error processing {symbol}: {e}")
                    continue

            # Remove closed positions
            for i in reversed(positions_to_remove):
                del self.open_positions[i]

            # Check for NEW TRADES across ALL symbols
            for symbol in self.symbols:
                try:
                    # Limit: 2 positions per symbol max
                    symbol_positions = [p for p in self.open_positions if p['symbol'] == symbol]
                    if len(symbol_positions) >= 2:
                        continue

                    # AGGRESSIVE cooldown: only 30 seconds per symbol
                    if current_time - self.last_trade_times[symbol] < 30:
                        continue

                    # Get 5-minute data for this symbol
                    df = self.iface.fetch_ohlcv(symbol, timeframe='5m', limit=30)
                    if df.empty:
                        continue

                    # Get aggressive strategy signal
                    action = get_fast_strategy_signal(df, self.strategy_type)

                    if action in ["buy", "sell"]:
                        balance = get_balance_db()
                        current_price = float(df["close"].iloc[-1])

                        # Calculate position size
                        if self.trade_amount:
                            pos_size = calculate_custom_position_size(self.trade_amount, current_price, self.stop_loss)
                            display_usd_amount = self.trade_amount
                        else:
                            pos_size = calculate_position_size(balance, self.risk_per_pair, current_price, self.stop_loss)
                            display_usd_amount = pos_size * current_price

                        if pos_size < 0.001:
                            pos_size = 0.001

                        # Execute trade
                        try:
                            order = self.iface.place_order(symbol, action, pos_size)
                            self.last_trade_times[symbol] = current_time
                            self.total_trade_count += 1

                            position = {
                                'trade_id': self.total_trade_count,
                                'symbol': symbol,
                                'side': action,
                                'entry_price': current_price,
                                'position_size': pos_size,
                                'usd_amount': display_usd_amount,
                                'timestamp': current_time
                            }
                            self.open_positions.append(position)

                            # Multi-pair trade logging
                            total_open = len(self.open_positions)
                            strategy_name = "AGG-EMA" if self.strategy_type == "aggressive_ema" else "BREAKOUT"

                            print(f"🚀 OPEN {symbol} #{self.total_trade_count} [{strategy_name}]: "
                                  f"{action.upper()} ${display_usd_amount:.2f} at ${current_price:.2f} | "
                                  f"Open: {total_open} across {len(self.symbols)} pairs | Total P&L: ${self.total_pnl:.2f}")

                        except Exception as order_error:
                            print(f"Order error {symbol}: {order_error}")

                except Exception as e:
                    print(f"Symbol {symbol} error: {e}")
                    continue

        except Exception as e:
            print(f"Super aggressive multi-pair bot error: {e}")

    def get_performance_stats(self):
        """Enhanced performance stats with per-pair breakdown"""
        total_trades = self.win_count + self.loss_count
        overall_win_rate = (self.win_count / max(total_trades, 1)) * 100

        # Calculate per-pair stats
        pair_stats = {}
        for symbol in self.symbols:
            pair_data = self.pair_performance[symbol]
            pair_total = pair_data['wins'] + pair_data['losses']
            pair_win_rate = (pair_data['wins'] / max(pair_total, 1)) * 100
            pair_stats[symbol] = {
                'trades': pair_total,
                'win_rate': pair_win_rate,
                'pnl': pair_data['pnl']
            }

        return {
            'total_pnl': self.total_pnl,
            'total_trades': total_trades,
            'win_count': self.win_count,
            'loss_count': self.loss_count,
            'overall_win_rate': overall_win_rate,
            'consecutive_losses': self.consecutive_losses,
            'open_positions': len(self.open_positions),
            'symbols_count': len(self.symbols),
            'pair_stats': pair_stats
        }
