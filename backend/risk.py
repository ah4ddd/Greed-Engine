def calculate_position_size(balance, risk_percent, price, stop_loss_percent):
    risk_amount = balance * (risk_percent / 100)
    stop_loss_price = price * (stop_loss_percent / 100)
    size = risk_amount / stop_loss_price
    return max(0, size)
