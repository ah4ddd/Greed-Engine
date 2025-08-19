def calculate_position_size(balance, risk_percent, price, stop_loss_percent):
    """Original position sizing based on account balance"""
    risk_amount = balance * (risk_percent / 100)
    stop_loss_price = price * (stop_loss_percent / 100)
    size = risk_amount / stop_loss_price
    return max(0, size)

def calculate_custom_position_size(trade_amount, price, stop_loss_percent):
    """NEW: Custom position sizing based on fixed trade amount"""
    stop_loss_price = price * (stop_loss_percent / 100)
    # Calculate position size based on trade amount instead of account balance
    size = trade_amount / price
    return max(0, size)
