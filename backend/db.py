from sqlalchemy import create_engine, Column, String, Float, Boolean, Integer, DateTime
from sqlalchemy.orm import sessionmaker
from backend.models import Base, Trade
import datetime
import os

# Create database directory if it doesn't exist
os.makedirs('database', exist_ok=True)

engine = create_engine("sqlite:///database/tradebot.sqlite")
Session = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(engine)

def get_balance_db():
    # For paper trading, start with $10,000
    return 10000.0

def log_trade(symbol, side, size, price, sl, tp, status, pnl=0):
    session = Session()
    trade = Trade(
        symbol=symbol,
        side=side,
        size=size,
        price=price,
        stop_loss=sl,
        take_profit=tp,
        status=status,
        pnl=pnl,
        timestamp=datetime.datetime.now()
    )
    session.add(trade)
    session.commit()
    trade_id = trade.id
    session.close()
    return trade_id

def update_trade_pnl(trade_id, exit_price, pnl, status):
    session = Session()
    trade = session.query(Trade).filter(Trade.id == trade_id).first()
    if trade:
        trade.exit_price = exit_price
        trade.pnl = pnl
        trade.status = status
        session.commit()
    session.close()

def get_account_balance():
    session = Session()
    trades = session.query(Trade).filter(Trade.status == 'EXECUTED').all()
    total_pnl = sum(trade.pnl or 0 for trade in trades)
    starting_balance = 10000.0
    current_balance = starting_balance + total_pnl
    session.close()

    return {
        "balance": current_balance,
        "total_pnl": total_pnl,
        "starting_balance": starting_balance,
        "total_trades": len(trades)
    }

def get_trade_history():
    session = Session()
    trades = session.query(Trade).order_by(Trade.timestamp.desc()).all()
    data = []
    for t in trades:
        data.append({
            "id": t.id,
            "symbol": t.symbol,
            "side": t.side,
            "size": t.size,
            "price": t.price,
            "exit_price": getattr(t, 'exit_price', None),
            "stop_loss": t.stop_loss,
            "take_profit": t.take_profit,
            "status": t.status,
            "pnl": t.pnl or 0,
            "timestamp": t.timestamp
        })
    session.close()
    return data

def save_settings(api_key, api_secret, exchange, symbol, real_mode, risk, stop_loss, take_profit):
    pass

def get_settings():
    return {}
