import React, { useState, useEffect, useCallback } from 'react';
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
    const [currentConfig, setCurrentConfig] = useState({
        api_key: '',
        api_secret: '',
        exchange: 'binance',
        symbol: 'BTC/USDT',
        symbols: ['BTC/USDT'],
        real_mode: false,
        risk: 1.0,
        stop_loss: 1.0,
        take_profit: 2.0,
        multi_pair_mode: false,
        aggressive_mode: false,
        super_aggressive_mode: false
    });
    const [configLoaded, setConfigLoaded] = useState(false);

    const loadInitialConfig = useCallback(async () => {
        if (configLoaded) return;

        try {
            console.log('App.js loading initial config...');
            const response = await axios.get('/api/load-config');
            if (response.data) {
                const config = response.data;

                // Ensure symbols array exists
                if (!config.symbols || !Array.isArray(config.symbols)) {
                    if (config.symbol) {
                        config.symbols = [config.symbol];
                    } else {
                        config.symbols = ['BTC/USDT'];
                        config.symbol = 'BTC/USDT';
                    }
                }

                // Ensure symbol is set
                if (!config.symbol && config.symbols.length > 0) {
                    config.symbol = config.symbols[0];
                }

                setCurrentConfig(config);
                setConfigLoaded(true);
                console.log('App.js loaded config:', config);
            }
        } catch (error) {
            console.error('Error loading initial config in App.js:', error);
            // Use default config if loading fails
            setConfigLoaded(true);
        }
    }, [configLoaded]);

    const fetchData = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        loadInitialConfig();
        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, [loadInitialConfig, fetchData]);

    const handleConfigChange = (newConfig) => {
        console.log('App.js received config update:', newConfig);

        // Update current config immediately for UI responsiveness
        setCurrentConfig(prevConfig => {
            const updatedConfig = { ...prevConfig, ...newConfig };

            // Ensure consistency
            if (!updatedConfig.symbols || !Array.isArray(updatedConfig.symbols)) {
                if (updatedConfig.symbol) {
                    updatedConfig.symbols = [updatedConfig.symbol];
                } else {
                    updatedConfig.symbols = ['BTC/USDT'];
                    updatedConfig.symbol = 'BTC/USDT';
                }
            }

            if (!updatedConfig.symbol && updatedConfig.symbols.length > 0) {
                updatedConfig.symbol = updatedConfig.symbols[0];
            }

            console.log('App.js config updated to:', updatedConfig);
            return updatedConfig;
        });
    };

    // Get display symbol
    const getDisplaySymbol = () => {
        if (currentConfig.multi_pair_mode && currentConfig.symbols && currentConfig.symbols.length > 0) {
            return currentConfig.symbols.length > 1
                ? `${currentConfig.symbols[0]} +${currentConfig.symbols.length - 1}`
                : currentConfig.symbols[0];
        }
        return currentConfig.symbol || 'BTC/USDT';
    };

    // Get primary trading symbol for charts and data
    const getPrimarySymbol = () => {
        if (currentConfig.multi_pair_mode && currentConfig.symbols && currentConfig.symbols.length > 0) {
            return currentConfig.symbols[0];
        }
        return currentConfig.symbol || 'BTC/USDT';
    };

    return (
        <div className="app">
            <div className="sidebar">
                <div className="logo">
                    <h2>Algorithmic Trading</h2>
                </div>
                <nav className="nav-menu">
                    <button
                        className={activeTab === 'dashboard' ? 'nav-item active' : 'nav-item'}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        <span className="nav-icon">■</span>
                        Dashboard
                    </button>
                    <button
                        className={activeTab === 'controls' ? 'nav-item active' : 'nav-item'}
                        onClick={() => setActiveTab('controls')}
                    >
                        <span className="nav-icon">▲</span>
                        Bot Controls
                    </button>
                    <button
                        className={activeTab === 'trades' ? 'nav-item active' : 'nav-item'}
                        onClick={() => setActiveTab('trades')}
                    >
                        <span className="nav-icon">≡</span>
                        Trade History
                    </button>
                    <button
                        className={activeTab === 'settings' ? 'nav-item active' : 'nav-item'}
                        onClick={() => setActiveTab('settings')}
                    >
                        <span className="nav-icon">⚙</span>
                        Settings
                    </button>
                </nav>
            </div>

            <div className="main-content">
                <div className="header">
                    <div className="header-left">
                        <h1>GREED ENGINE <span className="header-separator">{/* // */}</span> TERMINAL</h1>
                    </div>
                    <div className="header-right">
                        <div className="trading-pair">{getDisplaySymbol()}</div>
                        <div className={`status-badge ${botStatus.running ? 'active' : 'inactive'}`}>
                            <div className="status-dot"></div>
                            <span>{botStatus.running ? 'ACTIVE' : 'INACTIVE'}</span>
                        </div>
                        <div className="mode-badge">
                            {currentConfig.real_mode ? 'LIVE' : 'PAPER'}
                        </div>
                        {(currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) && (
                            <div className="speed-badge">
                                {currentConfig.super_aggressive_mode ? '🚀 SUPER' : '⚡ FAST'}
                            </div>
                        )}
                    </div>
                </div>

                <div className="content">
                    {activeTab === 'dashboard' && (
                        <Dashboard
                            balance={balance}
                            trades={trades}
                            currentSymbol={getPrimarySymbol()}
                            config={currentConfig}
                        />
                    )}
                    {activeTab === 'controls' && (
                        <BotControls
                            settings={currentConfig}
                            botStatus={botStatus}
                            onRefresh={fetchData}
                            onConfigChange={handleConfigChange}
                        />
                    )}
                    {activeTab === 'trades' && <TradeHistory trades={trades} />}
                    {activeTab === 'settings' && (
                        <Settings
                            onSettingsChange={handleConfigChange}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
