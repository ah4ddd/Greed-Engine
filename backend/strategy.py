import pandas as pd

def moving_average_crossover(df, short=9, long=21):
    """Original moving average crossover strategy"""
    df["ma_short"] = df["close"].rolling(short).mean()
    df["ma_long"] = df["close"].rolling(long).mean()
    if df["ma_short"].iloc[-2] < df["ma_long"].iloc[-2] and df["ma_short"].iloc[-1] > df["ma_long"].iloc[-1]:
        return "buy"
    elif df["ma_short"].iloc[-2] > df["ma_long"].iloc[-2] and df["ma_short"].iloc[-1] < df["ma_long"].iloc[-1]:
        return "sell"
    return "hold"

def custom_strategy(df, short=9, long=21):
    """Custom strategy - same MA logic but uses user-defined risk management"""
    df["ma_short"] = df["close"].rolling(short).mean()
    df["ma_long"] = df["close"].rolling(long).mean()
    if df["ma_short"].iloc[-2] < df["ma_long"].iloc[-2] and df["ma_short"].iloc[-1] > df["ma_long"].iloc[-1]:
        return "buy"
    elif df["ma_short"].iloc[-2] > df["ma_long"].iloc[-2] and df["ma_short"].iloc[-1] < df["ma_long"].iloc[-1]:
        return "sell"
    return "hold"

def get_strategy_signal(df, strategy_type="default_ma", short=9, long=21):
    """Main strategy dispatcher"""
    if strategy_type == "custom":
        return custom_strategy(df, short, long)
    else:
        return moving_average_crossover(df, short, long)
