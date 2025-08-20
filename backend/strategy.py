import pandas as pd

def check_volatility_filter(df, max_volatility_percent=5.0):
    """Check if current volatility is within acceptable range"""
    if len(df) < 2:
        return True

    current_price = df['close'].iloc[-1]
    prev_price = df['close'].iloc[-2]
    price_change_percent = abs((current_price - prev_price) / prev_price * 100)

    return price_change_percent <= max_volatility_percent

def moving_average_crossover(df, short=9, long=21):
    """Original moving average crossover strategy"""
    # Make explicit copy to avoid SettingWithCopyWarning
    df = df.copy()
    df.loc[:, "ma_short"] = df["close"].rolling(short).mean()
    df.loc[:, "ma_long"] = df["close"].rolling(long).mean()
    if df["ma_short"].iloc[-2] < df["ma_long"].iloc[-2] and df["ma_short"].iloc[-1] > df["ma_long"].iloc[-1]:
        return "buy"
    elif df["ma_short"].iloc[-2] > df["ma_long"].iloc[-2] and df["ma_short"].iloc[-1] < df["ma_long"].iloc[-1]:
        return "sell"
    return "hold"

def custom_strategy(df, short=9, long=21):
    """Custom strategy - same MA logic but uses user-defined risk management"""
    # Make explicit copy to avoid SettingWithCopyWarning
    df = df.copy()
    df.loc[:, "ma_short"] = df["close"].rolling(short).mean()
    df.loc[:, "ma_long"] = df["close"].rolling(long).mean()
    if df["ma_short"].iloc[-2] < df["ma_long"].iloc[-2] and df["ma_short"].iloc[-1] > df["ma_long"].iloc[-1]:
        return "buy"
    elif df["ma_short"].iloc[-2] > df["ma_long"].iloc[-2] and df["ma_short"].iloc[-1] < df["ma_long"].iloc[-1]:
        return "sell"
    return "hold"

def get_strategy_signal(df, strategy_type="default_ma", short=9, long=21, enable_volatility_filter=True):
    """Main strategy dispatcher with volatility filter"""

    # Apply volatility filter
    if enable_volatility_filter and not check_volatility_filter(df):
        return "hold"  # Skip trade during high volatility

    if strategy_type == "custom":
        return custom_strategy(df, short, long)
    else:
        return moving_average_crossover(df, short, long)
