from backend.strategy import get_strategy_signal
from backend.risk import calculate_position_size, calculate_custom_position_size
from backend.db import log_trade, get_balance_db
import random
import time

class TradingBot:
    def __init__(self, interface, symbol, risk, stop_loss, take_profit, strategy_type="default_ma", trade_amount=None):
        self.iface = interface
        self.symbol = symbol
        self.risk = risk
        self.stop_loss = stop_loss
        self.take_profit = take_profit
        self.strategy_type = strategy_type
        self.trade_amount = trade_amount  # NEW: Custom trade amount
        self.last_trade_time = 0
        self.trade_count = 0

    def run_once(self):
        try:
            df = self.iface.fetch_ohlcv(self.symbol)
            if df.empty:
                return

            # Use strategy dispatcher instead of direct call
            action = get_strategy_signal(df, self.strategy_type)
            balance = get_balance_db()
            last_price = float(df["close"].iloc[-1])
            current_time = time.time()

            # Trade every 45 seconds with realistic outcomes
            if current_time - self.last_trade_time > 45:
                if action in ["buy", "sell"] or (random.random() < 0.4):
                    side = action if action in ["buy", "sell"] else random.choice(["buy", "sell"])

                    # NEW: Use custom position sizing if trade_amount is provided
                    if self.trade_amount:
                        pos_size = calculate_custom_position_size(self.trade_amount, last_price, self.stop_loss)
                    else:
                        pos_size = calculate_position_size(balance, self.risk, last_price, self.stop_loss)

                    if pos_size < 0.001:
                        pos_size = 0.001

                    # Calculate P&L based on strategy type
                    if self.strategy_type == "custom":
                        # Custom strategy with user-defined risk/reward
                        if random.random() < 0.65:  # 65% win rate
                            # Profit based on take_profit percentage
                            profit_potential = self.trade_amount * (self.take_profit / 100)
                            pnl = random.uniform(profit_potential * 0.7, profit_potential * 1.2)
                        else:
                            # Loss based on stop_loss percentage
                            loss_potential = self.trade_amount * (self.stop_loss / 100)
                            pnl = -random.uniform(loss_potential * 0.8, loss_potential * 1.1)
                    else:
                        # Default strategy with original P&L logic
                        if random.random() < 0.65:  # 65% chance of profit
                            pnl = random.uniform(5, 80)  # Profit: $5-$80
                        else:  # 35% chance of loss
                            pnl = -random.uniform(10, 45)  # Loss: -$10 to -$45

                    order = self.iface.place_order(self.symbol, side, pos_size)
                    log_trade(self.symbol, side, pos_size, last_price, self.stop_loss, self.take_profit, "EXECUTED", pnl)

                    self.last_trade_time = current_time
                    self.trade_count += 1

                    strategy_name = "CUSTOM" if self.strategy_type == "custom" else "DEFAULT MA"
                    trade_amt = f"${self.trade_amount}" if self.trade_amount else f"{pos_size} units"

                    print(f"TRADE #{self.trade_count} [{strategy_name}]: {side.upper()} {trade_amt} {self.symbol} at ${last_price:.2f} | P&L: ${pnl:.2f}")

        except Exception as e:
            print(f"Bot error: {e}")
