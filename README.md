# Minimal Algorithmic Trading Bot

A fully working, rules-based bot for **Forex & crypto**, featuring:

* Stop-loss, take-profit, risk management (1% per trade)
* Simple moving average crossover strategy
* Paper & real trading with a clean web UI
* Logs, trade history, and bot settings stored in SQLite
* Deployable locally or on Render/Heroku

---

## ⚡ Features

### **Trading**

* **Stop-Loss:** Automatically exits trades at a predefined small loss limit.
* **Take-Profit:** Automatically closes trades when target profit is reached.
* **Risk Management:** Limits each trade to a small percentage of the account balance (1% max).
* **Single Strategy:** Moving average crossover strategy for Forex and crypto.
* **Paper Trading Mode:** Default, simulated trades for safe testing.
* **Real Account Mode:** Executes trades on live accounts using broker API keys.

### **Database**

* SQLite database automatically created (`database/tradebot.sqlite`).
* Stores trade history, logs, bot settings, and backtesting results.
* No manual setup required.

### **Front-End**

* Web interface built with Streamlit:

  * Input API keys for live trading
  * Start/Stop the bot
  * View live trades, account balance, P\&L
  * Adjust stop-loss, take-profit, and select instruments
  * Run backtests to simulate historical trades

---

## ⚙️ Deployment

### **Local Setup**

1. Clone the repository:

   ```bash
   git clone <repository_url>
   cd trading-bot
   ```
2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```
3. Copy environment template and fill in API keys:

   ```bash
   cp .env.example .env
   ```
4. Run the bot locally:

   ```bash
   streamlit run app.py
   ```
5. Open the web UI: `http://localhost:8501`

### **Render/Heroku Deployment**

1. Push repo to GitHub.
2. Connect GitHub repository to Render or Heroku.
3. Set environment variables in the dashboard (`.env` values).
4. Deploy as a web service.
5. SQLite database file will be created automatically in the container.

---

## 🔒 Connecting Your Forex Account

1. Generate **API Key and Secret** from your broker (OANDA, FXCM, etc.).
2. Add your API credentials to `.env` or use the front-end input fields:

   ```env
   FOREX_API_KEY=your_forex_key_here
   FOREX_API_SECRET=your_forex_secret_here
   ```
3. Toggle **Real Account Mode** in the UI to enable live trading.
4. Start the bot — trades will execute automatically, respecting risk rules.

> ⚠️ Always test in Paper Mode first to understand behavior before trading with real funds.

---

## ⚠️ Safety Guidelines

* Default mode is **Paper Trading** — no real money is risked.
* Maximum 1% risk per trade; stop-loss and take-profit are enforced automatically.
* Monitor trades regularly and use the **Stop Bot** button to safely halt execution.
* API keys are stored securely in `.env` — **never share them**.

---

## 📊 Backtesting

* Run backtests directly in the UI to simulate strategies on historical Forex or crypto data.
* View performance metrics and trade history before using live accounts.

---

# Enjoy Trading!

A clean, minimal, functional bot designed to execute simple strategies safely while giving you a professional trading experience.


