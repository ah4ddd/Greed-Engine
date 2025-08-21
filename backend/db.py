from sqlalchemy import create_engine, Column, String, Float, Boolean, Integer, DateTime, text
from sqlalchemy.orm import sessionmaker
from backend.models import Base, Trade
import datetime
import os

# Create database directory if it doesn't exist
os.makedirs('database', exist_ok=True)

engine = create_engine("sqlite:///database/tradebot.sqlite")
Session = sessionmaker(bind=engine)

def migrate_database():
    """Add new columns to existing database if they don't exist"""
    try:
        with engine.connect() as conn:
            # Check if trading_mode column exists
            try:
                conn.execute(text("SELECT trading_mode FROM trades LIMIT 1"))
            except:
                # Add trading_mode column if it doesn't exist
                conn.execute(text("ALTER TABLE trades ADD COLUMN trading_mode VARCHAR DEFAULT 'spot'"))
                print("Added trading_mode column to database")

            # Check if leverage column exists
            try:
                conn.execute(text("SELECT leverage FROM trades LIMIT 1"))
            except:
                # Add leverage column if it doesn't exist
                conn.execute(text("ALTER TABLE trades ADD COLUMN leverage INTEGER DEFAULT 1"))
                print("Added leverage column to database")

            conn.commit()
    except Exception as e:
        print(f"Migration error (this is usually safe to ignore): {e}")

def init_db():
    Base.metadata.create_all(engine)
    migrate_database()  # NEW: Run migration after creating tables

def get_balance_db():
    return 10000.0

def log_trade(symbol, side, size, price, sl, tp, status, pnl=0, trading_mode='spot', leverage=1):
    session = Session()
    try:
        trade = Trade(
            symbol=symbol,
            side=side,
            size=size,
            price=price,
            stop_loss=sl,
            take_profit=tp,
            status=status,
            pnl=pnl,
            timestamp=datetime.datetime.now(),
            trading_mode=trading_mode.lower(),
            leverage=leverage
        )
        session.add(trade)
        session.commit()
        trade_id = trade.id
        return trade_id
    except Exception as e:
        session.rollback()
        print(f"Database error in log_trade: {e}")
        return None
    finally:
        session.close()

def update_trade_pnl(trade_id, exit_price, pnl, status):
    session = Session()
    try:
        trade = session.query(Trade).filter(Trade.id == trade_id).first()
        if trade:
            trade.exit_price = exit_price
            trade.pnl = pnl
            trade.status = status
            session.commit()
    except Exception as e:
        session.rollback()
        print(f"Database error in update_trade_pnl: {e}")
    finally:
        session.close()

def get_account_balance():
    session = Session()
    try:
        trades = session.query(Trade).filter(Trade.status == 'EXECUTED').all()
        total_pnl = sum(trade.pnl or 0 for trade in trades)
        starting_balance = 10000.0
        current_balance = starting_balance + total_pnl

        return {
            "balance": current_balance,
            "total_pnl": total_pnl,
            "starting_balance": starting_balance,
            "total_trades": len(trades)
        }
    except Exception as e:
        print(f"Database error in get_account_balance: {e}")
        return {
            "balance": 10000.0,
            "total_pnl": 0,
            "starting_balance": 10000.0,
            "total_trades": 0
        }
    finally:
        session.close()

def get_trade_history():
    session = Session()
    try:
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
                "timestamp": t.timestamp,
                "trading_mode": getattr(t, 'trading_mode', 'spot'),
                "leverage": getattr(t, 'leverage', 1)
            })
        return data
    except Exception as e:
        print(f"Database error in get_trade_history: {e}")
        return []
    finally:
        session.close()

def save_settings(api_key, api_secret, exchange, symbol, real_mode, risk, stop_loss, take_profit):
    pass

def get_settings():
    return {}
