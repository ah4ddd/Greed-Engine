from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Trade(Base):
    __tablename__ = 'trades'

    id = Column(Integer, primary_key=True)
    symbol = Column(String)
    side = Column(String)
    size = Column(Float)
    price = Column(Float)
    exit_price = Column(Float)
    stop_loss = Column(Float)
    take_profit = Column(Float)
    status = Column(String)
    pnl = Column(Float, default=0)
    timestamp = Column(DateTime)

    # NEW: Add trading mode and leverage tracking
    trading_mode = Column(String, default='spot')  # 'spot' or 'futures'
    leverage = Column(Integer, default=1)  # leverage used (1 for spot, 2-10+ for futures)
