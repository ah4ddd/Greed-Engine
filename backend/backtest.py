import pandas as pd

def run_backtest(symbol, years, risk, stop_loss, take_profit):
    # In reality, you'd pull price history and simulate
    # Here, returns will be random/deterministic for "fun"
    return {"summary": f"Backtest for {symbol}: Years={years}, Risk={risk}%, Stop={stop_loss}%, TP={take_profit}% (Demo: always wins!)"}
