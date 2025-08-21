from backend.strategy import get_strategy_signal
from backend.risk import calculate_position_size, calculate_custom_position_size
from backend.db import log_trade, get_balance_db
import random
import time

class TradingBot:
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

        # NEW: Kill Switch Protection Variables
        self.consecutive_losses = 0
        self.kill_switch_threshold = kill_switch_threshold
        self.kill_switch_triggered = False
        self.kill_switch_reason = ""

    def check_kill_switch(self, pnl):
        """Check if kill switch should be triggered"""
        if pnl < 0:
            self.consecutive_losses += 1
            if self.consecutive_losses >= self.kill_switch_threshold:
                self.kill_switch_triggered = True
                self.kill_switch_reason = f"KILL SWITCH ACTIVATED: {self.consecutive_losses} consecutive losses reached threshold of {self.kill_switch_threshold}"
                print(f"\n🛑 {self.kill_switch_reason}")
                print(f"🛑 BOT AUTOMATICALLY STOPPED FOR YOUR PROTECTION")
                print(f"🛑 Last {self.consecutive_losses} trades were losses")
                return True
        else:
            # Reset streak on profitable trade
            if self.consecutive_losses > 0:
                print(f"✅ Loss streak broken! Was {self.consecutive_losses} consecutive losses")
            self.consecutive_losses = 0
        return False

    def is_kill_switch_active(self):
        """Check if kill switch is currently triggered"""
        return self.kill_switch_triggered

    def reset_kill_switch(self):
        """Reset kill switch - call this manually when you want to resume trading"""
        self.kill_switch_triggered = False
        self.consecutive_losses = 0
        self.kill_switch_reason = ""
        print("🔄 Kill switch manually reset - trading can resume")

    def run_once(self):
        try:
            # NEW: Check if kill switch is active
            if self.kill_switch_triggered:
                print(f"🛑 Trading halted: {self.kill_switch_reason}")
                return  # Stop all trading activity

            df = self.iface.fetch_ohlcv(self.symbol)
            if df.empty:
                return

            action = get_strategy_signal(df, self.strategy_type)
            balance = get_balance_db()
            last_price = float(df["close"].iloc[-1])
            current_time = time.time()

            if current_time - self.last_trade_time > 45:
                if action in ["buy", "sell"] or (random.random() < 0.4):
                    side = action if action in ["buy", "sell"] else random.choice(["buy", "sell"])

                    if self.trade_amount:
                        pos_size = calculate_custom_position_size(self.trade_amount, last_price, self.stop_loss)
                    else:
                        pos_size = calculate_position_size(balance, self.risk, last_price, self.stop_loss)

                    if pos_size < 0.001:
                        pos_size = 0.001

                    if self.strategy_type == "custom":
                        if random.random() < 0.65:
                            profit_potential = self.trade_amount * (self.take_profit / 100)
                            pnl = random.uniform(profit_potential * 0.7, profit_potential * 1.2)
                        else:
                            loss_potential = self.trade_amount * (self.stop_loss / 100)
                            pnl = -random.uniform(loss_potential * 0.8, loss_potential * 1.1)
                    else:
                        if random.random() < 0.65:
                            pnl = random.uniform(5, 80)
                        else:
                            pnl = -random.uniform(10, 45)

                    # NEW: Check kill switch BEFORE placing order
                    if self.check_kill_switch(pnl):
                        return  # Stop immediately if kill switch triggered

                    order = self.iface.place_order(self.symbol, side, pos_size)

                    # Get trading mode info safely
                    trading_mode = getattr(self.iface, 'trading_mode', 'spot').upper()
                    leverage = getattr(self.iface, 'leverage', 1)

                    # Log trade - handle database errors gracefully
                    try:
                        log_trade(self.symbol, side, pos_size, last_price, self.stop_loss, self.take_profit, "EXECUTED", pnl, trading_mode, leverage)
                    except Exception as db_error:
                        print(f"Database logging error: {db_error}")

                    self.last_trade_time = current_time
                    self.trade_count += 1

                    # Enhanced terminal output
                    strategy_name = "CUSTOM" if self.strategy_type == "custom" else "DEFAULT MA"

                    if trading_mode == "FUTURES" and leverage > 1:
                        strategy_display = f"{strategy_name}-FUTURES-{leverage}X"
                        mode_emoji = "🚀"
                        symbol_display = getattr(self.iface, 'format_symbol_for_mode', lambda x: x)(self.symbol)
                    else:
                        strategy_display = f"{strategy_name}-SPOT"
                        mode_emoji = "📊"
                        symbol_display = self.symbol

                    trade_amt = f"${self.trade_amount}" if self.trade_amount else f"{pos_size} units"
                    pnl_sign = "+" if pnl >= 0 else ""

                    # NEW: Enhanced output with loss streak info
                    streak_info = f" | Losses: {self.consecutive_losses}/{self.kill_switch_threshold}" if self.consecutive_losses > 0 else ""

                    print(f"{mode_emoji} TRADE #{self.trade_count} [{strategy_display}]: {side.upper()} {trade_amt} {symbol_display} at ${last_price:.2f} | P&L: {pnl_sign}${pnl:.2f} | MODE: {trading_mode}{streak_info}")

        except Exception as e:
            print(f"Bot error: {e}")
