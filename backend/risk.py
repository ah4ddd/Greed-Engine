def calculate_position_size(balance, risk_percent, price, stop_loss_percent):
    """Enhanced position sizing with maximum risk limits"""
    # Never risk more than 2% on a single trade, regardless of user setting
    safe_risk_percent = min(risk_percent, 2.0)

    risk_amount = balance * (safe_risk_percent / 100)
    stop_loss_distance = price * (stop_loss_percent / 100)

    if stop_loss_distance <= 0:
        return 0

    size = risk_amount / stop_loss_distance

    # Additional safety: Position can't be more than 10% of total balance
    max_position_value = balance * 0.1
    max_size_by_value = max_position_value / price

    final_size = min(size, max_size_by_value)
    return max(0, final_size)

def calculate_custom_position_size(trade_amount, price, stop_loss_percent):
    """Enhanced custom position sizing with safety limits"""
    if price <= 0 or stop_loss_percent <= 0:
        return 0

    # Basic position size
    btc_size = trade_amount / price

    # Safety check: Don't allow positions larger than $1000 worth
    max_position_value = min(trade_amount, 1000)
    max_safe_size = max_position_value / price

    final_size = min(btc_size, max_safe_size)
    return max(0, final_size)

def calculate_dynamic_stop_loss(df, base_stop_loss, volatility_multiplier=1.5):
    """Calculate stop loss based on recent volatility"""
    if len(df) < 20:
        return base_stop_loss

    # Calculate recent volatility (20-period ATR approximation)
    high_low = df['high'] - df['low']
    high_close_prev = abs(df['high'] - df['close'].shift(1))
    low_close_prev = abs(df['low'] - df['close'].shift(1))

    true_range = pd.concat([high_low, high_close_prev, low_close_prev], axis=1).max(axis=1)
    atr = true_range.rolling(20).mean().iloc[-1]

    current_price = df['close'].iloc[-1]
    atr_percent = (atr / current_price) * 100

    # Adjust stop loss based on volatility
    # High volatility = wider stops, Low volatility = tighter stops
    dynamic_stop = base_stop_loss + (atr_percent * volatility_multiplier)

    # Keep within reasonable bounds (1% to 8%)
    return max(1.0, min(8.0, dynamic_stop))

def calculate_dynamic_take_profit(df, base_take_profit, trend_strength="neutral"):
    """Calculate take profit based on trend and volatility"""
    if len(df) < 20:
        return base_take_profit

    # In strong trends, allow for bigger profits
    if trend_strength == "strong_up" or trend_strength == "strong_down":
        return base_take_profit * 1.5

    return base_take_profit

def kelly_criterion_position_size(balance, win_rate, avg_win, avg_loss):
    """Kelly Criterion for optimal position sizing (optional advanced feature)"""
    if avg_loss <= 0 or win_rate <= 0 or win_rate >= 1:
        return 0

    # Kelly formula: f = (bp - q) / b
    # where b = avg_win/avg_loss, p = win_rate, q = 1 - win_rate
    b = avg_win / abs(avg_loss)
    p = win_rate
    q = 1 - win_rate

    kelly_fraction = (b * p - q) / b

    # Never use more than 25% of Kelly (quarter-Kelly for safety)
    safe_kelly = max(0, min(kelly_fraction * 0.25, 0.05))  # Max 5% of balance

    return balance * safe_kelly
