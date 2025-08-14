import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import TradeHistory from './components/TradeHistory';
import BotControls from './components/BotControls';
import axios from 'axios';

function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [balance, setBalance] = useState({ balance: 10000 });
    const [trades, setTrades] = useState([]);
    const [botStatus, setBotStatus] = useState({ running: false });
    const [settings, setSettings] = useState({
        api_key: '',
        api_secret: '',
        exchange: 'binance',
        symbol: 'BTC/USDT',
        real_mode: false,
        risk: 1.0,
        stop_loss: 1.0,
        take_profit: 2.0
    });

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [balanceRes, tradesRes, statusRes] = await Promise.all([
                axios.get('/api/balance'),
                axios.get('/api/trades'),
                axios.get('/api/status')
            ]);
            setBalance(balanceRes.data);
            setTrades(tradesRes.data);
            setBotStatus(statusRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    return (
        <div className="app">
            <div className="sidebar">
                <div className="logo">
                    <h2>AlgoTrader Pro</h2>
                    <span className="version">v2.0</span>
                </div>
                <nav className="nav-menu">
                    <button
                        className={activeTab === 'dashboard' ? 'nav-item active' : 'nav-item'}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        Dashboard
                    </button>
                    <button
                        className={activeTab === 'controls' ? 'nav-item active' : 'nav-item'}
                        onClick={() => setActiveTab('controls')}
                    >
                        Bot Controls
                    </button>
                    <button
                        className={activeTab === 'trades' ? 'nav-item active' : 'nav-item'}
                        onClick={() => setActiveTab('trades')}
                    >
                        Trade History
                    </button>
                    <button
                        className={activeTab === 'settings' ? 'nav-item active' : 'nav-item'}
                        onClick={() => setActiveTab('settings')}
                    >
                        Settings
                    </button>
                </nav>
            </div>

            <div className="main-content">
                <div className="header">
                    <div className="header-left">
                        <h1>Trading Terminal</h1>
                        <span className="header-subtitle">Professional Algorithmic Trading</span>
                    </div>
                    <div className="header-right">
                        <div className="trading-pair">{settings.symbol}</div>
                        <div className={`status-badge ${botStatus.running ? 'active' : 'inactive'}`}>
                            <div className="status-dot"></div>
                            <span>{botStatus.running ? 'Trading Active' : 'Bot Stopped'}</span>
                        </div>
                        <div className="mode-badge">
                            {settings.real_mode ? 'LIVE TRADING' : 'PAPER TRADING'}
                        </div>
                    </div>
                </div>

                <div className="content">
                    {activeTab === 'dashboard' && (
                        <Dashboard
                            balance={balance}
                            trades={trades}
                            currentSymbol={settings.symbol}
                        />
                    )}
                    {activeTab === 'controls' && (
                        <BotControls
                            settings={settings}
                            botStatus={botStatus}
                            onRefresh={fetchData}
                        />
                    )}
                    {activeTab === 'trades' && <TradeHistory trades={trades} />}
                    {activeTab === 'settings' && (
                        <Settings
                            settings={settings}
                            setSettings={setSettings}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
