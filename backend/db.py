from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.models import Base, Trade
import datetime
import os

os.makedirs('database', exist_ok=True)

# Global variables for database connections
_engines = {}
_sessions = {}
_current_mode = None

def get_trading_mode():
    """Get current trading mode from environment or default to paper"""
    global _current_mode
    if _current_mode is None:
        _current_mode = os.getenv('TRADING_MODE', 'paper').lower()
    return _current_mode

def set_trading_mode(mode):
    """Set trading mode (paper or live)"""
    global _current_mode
    _current_mode = mode.lower()

def get_database_path(mode):
    """Get database path based on trading mode"""
    if mode == 'live':
        return "sqlite:///database/tradebot_live.sqlite"
    else:
        return "sqlite:///database/tradebot_paper.sqlite"

def get_engine(mode=None):
    """Get database engine for specified mode"""
    if mode is None:
        mode = get_trading_mode()

    if mode not in _engines:
        db_path = get_database_path(mode)
        _engines[mode] = create_engine(db_path)

    return _engines[mode]

def get_session(mode=None):
    """Get database session for specified mode"""
    if mode is None:
        mode = get_trading_mode()

    if mode not in _sessions:
        engine = get_engine(mode)
        _sessions[mode] = sessionmaker(bind=engine)

    return _sessions[mode]

def migrate_database(mode=None):
    """Add new columns to existing database if they don't exist"""
    if mode is None:
        mode = get_trading_mode()

    engine = get_engine(mode)
    try:
        with engine.connect() as conn:
            try:
                conn.execute(text("SELECT usd_amount FROM trades LIMIT 1"))
            except:
                conn.execute(text("ALTER TABLE trades ADD COLUMN usd_amount FLOAT DEFAULT 0"))
                print(f"Added usd_amount column to {mode} database")
            conn.commit()
    except Exception:
        pass

def init_db(mode=None):
    """Initialize database for specified mode"""
    if mode is None:
        mode = get_trading_mode()

    engine = get_engine(mode)
    Base.metadata.create_all(engine)
    migrate_database(mode)

def init_all_databases():
    """Initialize both paper and live databases"""
    init_db('paper')
    init_db('live')
    print("Both paper and live databases initialized")

def get_balance_db(mode=None):
    """Get balance from database - always returns 10000 for paper mode"""
    if mode is None:
        mode = get_trading_mode()

    if mode == 'paper':
        return 10000.0
    else:
        # For live mode, you might want to fetch actual balance from exchange
        # For now, we'll calculate from trades
        balance_info = get_account_balance(mode)
        return balance_info['balance']

def log_trade(
    symbol, side, size, price, sl, tp, status,
    pnl=0, trading_mode='spot', leverage=1, usd_amount=None, db_mode=None
):
    """Log trade to appropriate database based on current trading mode"""
    if db_mode is None:
        db_mode = get_trading_mode()

    Session = get_session(db_mode)
    session = Session()
    try:
        if usd_amount is None:
            usd_amount = size * price
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
            leverage=leverage,
            usd_amount=usd_amount
        )
        session.add(trade)
        session.commit()
        return trade.id
    except Exception as e:
        session.rollback()
        print(f"Database error in log_trade ({db_mode}): {e}")
        return None
    finally:
        session.close()

def update_trade_pnl(trade_id, exit_price, pnl, status, mode=None):
    """Update trade PnL in appropriate database"""
    if mode is None:
        mode = get_trading_mode()

    Session = get_session(mode)
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
        print(f"Database error in update_trade_pnl ({mode}): {e}")
    finally:
        session.close()

def get_account_balance(mode=None):
    """Get account balance from appropriate database"""
    if mode is None:
        mode = get_trading_mode()

    Session = get_session(mode)
    session = Session()
    try:
        trades = session.query(Trade).filter(Trade.status == 'EXECUTED').all()
        total_pnl = sum(t.pnl or 0 for t in trades)
        starting_balance = 10000.0
        current_balance = starting_balance + total_pnl
        return {
            "balance": current_balance,
            "total_pnl": total_pnl,
            "starting_balance": starting_balance,
            "total_trades": len(trades),
            "trading_mode": mode
        }
    except Exception as e:
        session.rollback()
        print(f"Database error in get_account_balance ({mode}): {e}")
        return {
            "balance": 10000.0,
            "total_pnl": 0,
            "starting_balance": 10000.0,
            "total_trades": 0,
            "trading_mode": mode
        }
    finally:
        session.close()

def get_trade_history(mode=None):
    """Get trade history from appropriate database"""
    if mode is None:
        mode = get_trading_mode()

    Session = get_session(mode)
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
                "trading_mode": t.trading_mode,
                "leverage": t.leverage,
                "usd_amount": t.usd_amount
            })
        return data
    except Exception as e:
        print(f"Database error in get_trade_history ({mode}): {e}")
        return []
    finally:
        session.close()

def save_settings(api_key, api_secret, exchange, symbol, real_mode, risk, stop_loss, take_profit):
    pass

def get_settings():
    return {}

# Migration function to rename existing database
def migrate_existing_database():
    """Rename existing tradebot.sqlite to tradebot_paper.sqlite if it exists"""
    old_path = "database/tradebot.sqlite"
    new_path = "database/tradebot_paper.sqlite"

    if os.path.exists(old_path) and not os.path.exists(new_path):
        try:
            os.rename(old_path, new_path)
            print(f"Migrated existing database from {old_path} to {new_path}")
            return True
        except Exception as e:
            print(f"Error migrating database: {e}")
            return False
    return False
