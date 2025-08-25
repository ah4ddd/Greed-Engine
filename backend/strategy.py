import pandas as pd
import numpy as np

def check_volatility_filter(df, max_volatility_percent=5.0, min_volatility_percent=0.5):
    """Enhanced volatility filter - avoid both too high and too low volatility"""
    if len(df) < 2:
        return True

    current_price = df['close'].iloc[-1]
    prev_price = df['close'].iloc[-2]
    price_change_percent = abs((current_price - prev_price) / prev_price * 100)

    # Avoid both extreme volatility and dead markets
    return min_volatility_percent <= price_change_percent <= max_volatility_percent

def calculate_rsi(df, period=14):
    """Calculate RSI for overbought/oversold conditions"""
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_ema(df, period):
    """Calculate Exponential Moving Average (faster than SMA)"""
    return df['close'].ewm(span=period).mean()

def calculate_macd(df, fast=12, slow=26, signal=9):
    """Calculate MACD for trend confirmation"""
    ema_fast = df['close'].ewm(span=fast).mean()
    ema_slow = df['close'].ewm(span=slow).mean()
    macd = ema_fast - ema_slow
    macd_signal = macd.ewm(span=signal).mean()
    macd_histogram = macd - macd_signal
    return macd, macd_signal, macd_histogram

def check_volume_confirmation(df, volume_sma_period=20):
    """Check if current volume supports the move"""
    if len(df) < volume_sma_period:
        return True

    current_volume = df['volume'].iloc[-1]
    avg_volume = df['volume'].rolling(volume_sma_period).mean().iloc[-1]

    # Current volume should be at least 80% of average volume
    return current_volume >= (avg_volume * 0.8)

def check_trend_strength(df, period=20):
    """Check if we're in a strong trend"""
    if len(df) < period:
        return "neutral"

    highs = df['high'].rolling(period).max()
    lows = df['low'].rolling(period).min()
    current_price = df['close'].iloc[-1]

    # Strong uptrend: price in upper 25% of recent range
    if current_price >= highs.iloc[-1] * 0.98:
        return "strong_up"
    # Strong downtrend: price in lower 25% of recent range
    elif current_price <= lows.iloc[-1] * 1.02:
        return "strong_down"
    else:
        return "neutral"

def advanced_ma_strategy(df, short=9, long=21):
    """Enhanced MA strategy with multiple confirmations"""
    if len(df) < max(long + 5, 26):  # Need enough data for all indicators
        return "hold"

    # Calculate indicators
    df = df.copy()
    df['ma_short'] = df['close'].rolling(short).mean()
    df['ma_long'] = df['close'].rolling(long).mean()
    df['rsi'] = calculate_rsi(df)
    macd, macd_signal, macd_hist = calculate_macd(df)
    df['macd'] = macd
    df['macd_signal'] = macd_signal
    df['macd_hist'] = macd_hist

    # Current and previous values
    ma_short_curr = df['ma_short'].iloc[-1]
    ma_short_prev = df['ma_short'].iloc[-2]
    ma_long_curr = df['ma_long'].iloc[-1]
    ma_long_prev = df['ma_long'].iloc[-2]

    rsi_curr = df['rsi'].iloc[-1]
    macd_curr = df['macd'].iloc[-1]
    macd_signal_curr = df['macd_signal'].iloc[-1]
    macd_hist_curr = df['macd_hist'].iloc[-1]

    current_price = df['close'].iloc[-1]
    trend_strength = check_trend_strength(df)

    # MA Crossover Detection
    bullish_cross = (ma_short_prev <= ma_long_prev and ma_short_curr > ma_long_curr)
    bearish_cross = (ma_short_prev >= ma_long_prev and ma_short_curr < ma_long_curr)

    # Enhanced Buy Conditions
    if bullish_cross:
        buy_confirmations = 0

        # 1. RSI not overbought (below 75)
        if rsi_curr < 75:
            buy_confirmations += 1

        # 2. MACD trending bullish
        if macd_curr > macd_signal_curr and macd_hist_curr > 0:
            buy_confirmations += 1

        # 3. Price above short MA (momentum confirmation)
        if current_price > ma_short_curr:
            buy_confirmations += 1

        # 4. Volume confirmation
        if check_volume_confirmation(df):
            buy_confirmations += 1

        # Need at least 3 out of 4 confirmations
        if buy_confirmations >= 3:
            return "buy"

    # Enhanced Sell Conditions
    elif bearish_cross:
        sell_confirmations = 0

        # 1. RSI not oversold (above 25)
        if rsi_curr > 25:
            sell_confirmations += 1

        # 2. MACD trending bearish
        if macd_curr < macd_signal_curr and macd_hist_curr < 0:
            sell_confirmations += 1

        # 3. Price below short MA (momentum confirmation)
        if current_price < ma_short_curr:
            sell_confirmations += 1

        # 4. Volume confirmation
        if check_volume_confirmation(df):
            sell_confirmations += 1

        # Need at least 3 out of 4 confirmations
        if sell_confirmations >= 3:
            return "sell"

    return "hold"

# NEW AGGRESSIVE STRATEGIES ADDED BELOW

def aggressive_scalping_strategy(df):
    """
    AGGRESSIVE SCALPING STRATEGY
    - Uses 5-minute candles
    - Fast EMA crossovers (5/13 instead of 9/21)
    - Minimal confirmations needed
    - Quick entries and exits
    """
    if len(df) < 20:
        return "hold"

    df = df.copy()

    # FAST EMAs for quick signals
    df['ema_fast'] = calculate_ema(df, 5)  # Much faster than 9
    df['ema_slow'] = calculate_ema(df, 13) # Much faster than 21
    df['rsi'] = calculate_rsi(df, 7)       # Faster RSI

    # Current values
    ema_fast_curr = df['ema_fast'].iloc[-1]
    ema_fast_prev = df['ema_fast'].iloc[-2]
    ema_slow_curr = df['ema_slow'].iloc[-1]
    ema_slow_prev = df['ema_slow'].iloc[-2]
    rsi_curr = df['rsi'].iloc[-1]
    current_price = df['close'].iloc[-1]

    # Price momentum (last 3 candles trend)
    price_momentum = (df['close'].iloc[-1] - df['close'].iloc[-4]) / df['close'].iloc[-4] * 100

    # BULLISH: Fast EMA crosses above slow EMA
    bullish_cross = (ema_fast_prev <= ema_slow_prev and ema_fast_curr > ema_slow_curr)

    # BEARISH: Fast EMA crosses below slow EMA
    bearish_cross = (ema_fast_prev >= ema_slow_prev and ema_fast_curr < ema_slow_curr)

    # AGGRESSIVE BUY CONDITIONS (only need 2 out of 3)
    if bullish_cross:
        buy_score = 0

        # 1. RSI shows momentum (between 40-80, not overbought)
        if 40 < rsi_curr < 80:
            buy_score += 1

        # 2. Price is trending up in last few candles
        if price_momentum > 0.1:  # At least 0.1% upward momentum
            buy_score += 1

        # 3. Price above fast EMA (momentum confirmation)
        if current_price > ema_fast_curr:
            buy_score += 1

        # Need at least 2 out of 3 (much lower threshold)
        if buy_score >= 2:
            return "buy"

    # AGGRESSIVE SELL CONDITIONS
    elif bearish_cross:
        sell_score = 0

        # 1. RSI shows downward momentum (between 20-60)
        if 20 < rsi_curr < 60:
            sell_score += 1

        # 2. Price trending down
        if price_momentum < -0.1:
            sell_score += 1

        # 3. Price below fast EMA
        if current_price < ema_fast_curr:
            sell_score += 1

        if sell_score >= 2:
            return "sell"

    return "hold"

def momentum_breakout_strategy(df):
    """Alternative momentum-based strategy"""
    if len(df) < 30:
        return "hold"

    df = df.copy()

    # Calculate indicators
    df['sma_20'] = df['close'].rolling(20).mean()
    df['bb_upper'] = df['sma_20'] + (df['close'].rolling(20).std() * 2)
    df['bb_lower'] = df['sma_20'] - (df['close'].rolling(20).std() * 2)
    df['rsi'] = calculate_rsi(df)

    current_price = df['close'].iloc[-1]
    sma_20 = df['sma_20'].iloc[-1]
    bb_upper = df['bb_upper'].iloc[-1]
    bb_lower = df['bb_lower'].iloc[-1]
    rsi = df['rsi'].iloc[-1]

    # Bullish breakout: Price breaks above BB upper with strong RSI
    if (current_price > bb_upper and
        current_price > sma_20 and
        rsi > 60 and rsi < 80 and
        check_volume_confirmation(df)):
        return "buy"

    # Bearish breakdown: Price breaks below BB lower with weak RSI
    if (current_price < bb_lower and
        current_price < sma_20 and
        rsi < 40 and rsi > 20 and
        check_volume_confirmation(df)):
        return "sell"

    return "hold"

def momentum_breakout_fast(df):
    """
    MOMENTUM BREAKOUT - Even more aggressive
    Trades on price breakouts above/below recent highs/lows
    """
    if len(df) < 10:
        return "hold"

    df = df.copy()

    # Recent high/low (last 8 candles)
    recent_high = df['high'].rolling(8).max().iloc[-1]
    recent_low = df['low'].rolling(8).min().iloc[-1]
    current_price = df['close'].iloc[-1]
    prev_price = df['close'].iloc[-2]

    # Volume spike detection
    avg_volume = df['volume'].rolling(10).mean().iloc[-1]
    current_volume = df['volume'].iloc[-1]
    volume_spike = current_volume > avg_volume * 1.2

    # BREAKOUT BUY: Price breaks above recent high with volume
    if current_price > recent_high and prev_price <= recent_high:
        if volume_spike or current_price > recent_high * 1.002:  # 0.2% breakout
            return "buy"

    # BREAKDOWN SELL: Price breaks below recent low with volume
    if current_price < recent_low and prev_price >= recent_low:
        if volume_spike or current_price < recent_low * 0.998:  # 0.2% breakdown
            return "sell"

    return "hold"

def custom_strategy(df, short=9, long=21):
    """Your custom strategy - now with proper logic"""
    return advanced_ma_strategy(df, short, long)

def moving_average_crossover(df, short=9, long=21):
    """Original MA crossover but enhanced"""
    return advanced_ma_strategy(df, short, long)

def get_strategy_signal(df, strategy_type="default_ma", short=9, long=21, enable_volatility_filter=True):
    """Main strategy dispatcher with enhanced filters"""

    # Apply volatility filter first
    if enable_volatility_filter and not check_volatility_filter(df):
        return "hold"

    # Choose strategy
    if strategy_type == "custom":
        signal = custom_strategy(df, short, long)
    elif strategy_type == "momentum":
        signal = momentum_breakout_strategy(df)
    elif strategy_type == "aggressive_ema":
        signal = aggressive_scalping_strategy(df)
    elif strategy_type == "breakout":
        signal = momentum_breakout_fast(df)
    else:
        signal = moving_average_crossover(df, short, long)

    # Final trend filter - avoid counter-trend trades in strong markets
    if signal != "hold":
        trend = check_trend_strength(df)

        # Don't short in strong uptrend, don't buy in strong downtrend
        if signal == "sell" and trend == "strong_up":
            return "hold"
        elif signal == "buy" and trend == "strong_down":
            return "hold"

    return signal

# NEW FAST STRATEGY FUNCTIONS FOR HIGH-FREQUENCY TRADING

def get_fast_strategy_signal(df, strategy_type="aggressive_ema"):
    """
    FAST STRATEGY DISPATCHER FOR HIGH-FREQUENCY TRADING
    No volatility filters, no trend filters - pure aggression
    """

    if strategy_type == "breakout":
        return momentum_breakout_fast(df)
    else:
        return aggressive_scalping_strategy(df)
