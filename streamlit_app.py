import streamlit as st
from backend.exchange import TradingInterface
from backend.bot_core import TradingBot
from backend.db import init_db, get_account_balance, get_trade_history, get_settings, save_settings
from backend.backtest import run_backtest

st.set_page_config(page_title="Minimal Trading Bot", layout="wide")
init_db()  # Ensures database tables

st.title("🪄 Minimal Trading Bot")

# Settings
st.sidebar.header("Settings")
api_key = st.sidebar.text_input("API Key", type="password")
api_secret = st.sidebar.text_input("API Secret", type="password")
exchange = st.sidebar.selectbox("Exchange", ["binance", "kraken", "bitfinex"])
real_mode = st.sidebar.checkbox("Real Trading Mode?", value=False)
symbol = st.sidebar.text_input("Trading Instrument (e.g., BTC/USDT, EUR/USD)", "BTC/USDT")
risk = st.sidebar.slider("Risk per trade (%)", min_value=0.1, max_value=1.0, value=1.0)
stop_loss = st.sidebar.number_input("Stop-Loss (%)", min_value=0.1, max_value=10.0, value=1.0)
take_profit = st.sidebar.number_input("Take-Profit (%)", min_value=0.1, max_value=10.0, value=2.0)

if st.sidebar.button("Save Bot Settings"):
    save_settings(api_key, api_secret, exchange, symbol, real_mode, risk, stop_loss, take_profit)
    st.sidebar.success("Settings saved.")

tab1, tab2, tab3, tab4 = st.tabs(["Trade Bot", "P&L/Account", "Trade History", "Backtest"])

with tab1:
    st.subheader("Trading Bot Controls")
    if st.button("START Bot"):
        st.session_state["bot_running"] = True
        st.success("Bot started.")
    if st.button("STOP Bot"):
        st.session_state["bot_running"] = False
        st.warning("Bot stopped.")

    if st.session_state.get("bot_running", False):
        st.write("Bot is running...")
        iface = TradingInterface(api_key, api_secret, exchange, real_mode)
        bot = TradingBot(iface, symbol, float(risk), float(stop_loss), float(take_profit))
        bot.run_once()

with tab2:
    st.subheader("Account Snapshot")
    balance = get_account_balance()
    st.write(balance)

with tab3:
    st.subheader("Trade History")
    trades = get_trade_history()
    st.write(trades)

with tab4:
    st.subheader("Backtest (for fun)")
    years = st.number_input("Years to backtest", min_value=1, max_value=10, value=2)
    if st.button("Run Backtest"):
        results = run_backtest(symbol, years, float(risk), float(stop_loss), float(take_profit))
        st.write(results)
