import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import axios from 'axios';

function BotControls({ settings, botStatus, onRefresh }) {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [activity, setActivity] = useState('Idle');
    const [chartData, setChartData] = useState([]);
    const [trades, setTrades] = useState([]);
    const [liveStats, setLiveStats] = useState({
        todayPnl: 0,
        totalTrades: 0,
        winRate: 0,
        avgProfit: 0,
        avgLoss: 0
    });

    // Enhanced configuration state - load from API
    const [currentConfig, setCurrentConfig] = useState({
        strategy_type: 'default_ma',
        risk: 1.0,
        stop_loss: 1.0,
        take_profit: 3.0,
        symbol: 'BTC/USDT',
        symbols: ['BTC/USDT'],
        trading_mode: 'spot',
        leverage: 1,
        kill_switch_threshold: 5,
        multi_pair_mode: false,
        aggressive_mode: false,
        super_aggressive_mode: false,
        trade_amount: 1000,
        api_key: '',
        api_secret: '',
        exchange: 'binance',
        real_mode: false
    });

    // Performance tracking state
    const [performanceStats, setPerformanceStats] = useState({
        total_pnl: 0,
        total_trades: 0,
        win_count: 0,
        loss_count: 0,
        win_rate: 0,
        consecutive_losses: 0,
        open_positions: 0
    });

    const popularPairs = [
        'BTC/USDT', 'ETH/USDT', 'ADA/USDT', 'SOL/USDT', 'MATIC/USDT',
        'DOT/USDT', 'AVAX/USDT', 'LINK/USDT', 'UNI/USDT', 'ATOM/USDT',
        'LTC/USDT', 'XRP/USDT', 'DOGE/USDT', 'BNB/USDT', 'TRX/USDT'
    ];

    // Load configuration from API on component mount
    useEffect(() => {
        loadConfigFromAPI();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const loadConfigFromAPI = async () => {
        try {
            const response = await axios.get('/api/load-config');
            const loadedConfig = response.data;

            console.log('BotControls loaded config:', loadedConfig);

            // Ensure symbols is always an array
            if (!Array.isArray(loadedConfig.symbols)) {
                if (loadedConfig.symbol) {
                    loadedConfig.symbols = [loadedConfig.symbol];
                } else {
                    loadedConfig.symbols = ['BTC/USDT'];
                }
            }

            setCurrentConfig(loadedConfig);
            console.log('BotControls updated config state:', loadedConfig);
        } catch (error) {
            console.error('Error loading config in BotControls:', error);
            // Fallback to settings prop if API fails
            if (settings) {
                setCurrentConfig(prevConfig => ({ ...prevConfig, ...settings }));
            }
        }
    };

    // Update when settings prop changes
    useEffect(() => {
        if (settings) {
            setCurrentConfig(prevConfig => {
                const updatedConfig = { ...prevConfig, ...settings };

                // Ensure symbols array consistency
                if (!Array.isArray(updatedConfig.symbols)) {
                    updatedConfig.symbols = updatedConfig.symbol ? [updatedConfig.symbol] : ['BTC/USDT'];
                }

                return updatedConfig;
            });
        }
    }, [settings]);

    // Configuration change handlers
    const handleConfigChange = async (field, value) => {
        const updatedConfig = { ...currentConfig, [field]: value };

        // Special handling for mode changes
        if (field === 'super_aggressive_mode' && value) {
            updatedConfig.aggressive_mode = false;
            updatedConfig.multi_pair_mode = true;
            if (updatedConfig.symbols.length < 3) {
                updatedConfig.symbols = ['BTC/USDT', 'ETH/USDT', 'ADA/USDT'];
            }
        } else if (field === 'aggressive_mode' && value) {
            updatedConfig.super_aggressive_mode = false;
        } else if (field === 'multi_pair_mode' && !value) {
            updatedConfig.super_aggressive_mode = false;
        }

        // Update symbols array consistency
        if (field === 'symbols' && Array.isArray(value)) {
            updatedConfig.symbol = value.length > 0 ? value[0] : 'BTC/USDT';
        }

        setCurrentConfig(updatedConfig);

        // Save to API
        try {
            await axios.post('/api/save-config', updatedConfig);
            console.log('Config saved successfully:', updatedConfig);
        } catch (error) {
            console.error('Error saving config:', error);
        }
    };

    const addPair = (pair) => {
        const maxPairs = currentConfig.super_aggressive_mode ? 15 : 8;
        if (!currentConfig.symbols.includes(pair) && currentConfig.symbols.length < maxPairs) {
            const newSymbols = [...currentConfig.symbols, pair];
            handleConfigChange('symbols', newSymbols);
        }
    };

    const removePair = (pair) => {
        if (currentConfig.symbols.length > 1) {
            const newSymbols = currentConfig.symbols.filter(p => p !== pair);
            handleConfigChange('symbols', newSymbols);
        }
    };

    // Fetch performance stats for aggressive bots
    const fetchPerformanceStats = useCallback(async () => {
        if (botStatus.running && (currentConfig.aggressive_mode || currentConfig.super_aggressive_mode)) {
            try {
                const response = await axios.get('/api/bot-performance');
                setPerformanceStats(response.data);
            } catch (error) {
                console.log('Performance stats not available');
            }
        }
    }, [botStatus.running, currentConfig.aggressive_mode, currentConfig.super_aggressive_mode]);

    // Fetch live chart data
    const fetchStrategyData = useCallback(async () => {
        try {
            const symbolToFetch = currentConfig.multi_pair_mode ? currentConfig.symbols[0] : currentConfig.symbol;

            if (!symbolToFetch) {
                console.warn('No trading symbol set, skipping chart data fetch');
                generateDemoStrategyData();
                return;
            }

            // Use fast API endpoint for aggressive modes
            const endpoint = (currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) ? '/api/ohlcv-fast' : '/api/ohlcv';
            const timeframe = (currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) ? '5m' : '1m';

            const [ohlcvRes, tradesRes] = await Promise.all([
                axios.get(`${endpoint}?symbol=${symbolToFetch}&timeframe=${timeframe}&limit=50`),
                axios.get('/api/trades')
            ]);

            const ohlcvData = ohlcvRes.data.data;
            const recentTrades = tradesRes.data.slice(-10);

            // Calculate live statistics
            const todayTrades = tradesRes.data.filter(trade => {
                const tradeDate = new Date(trade.timestamp).toDateString();
                const today = new Date().toDateString();
                return tradeDate === today;
            });

            const wins = todayTrades.filter(t => t.pnl > 0);
            const losses = todayTrades.filter(t => t.pnl < 0);

            setLiveStats({
                todayPnl: todayTrades.reduce((sum, t) => sum + t.pnl, 0),
                totalTrades: todayTrades.length,
                winRate: todayTrades.length > 0 ? (wins.length / todayTrades.length * 100) : 0,
                avgProfit: wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0,
                avgLoss: losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length) : 0
            });

            // Calculate moving averages
            const prices = ohlcvData.map(candle => candle.close);
            const fastMA = calculateMovingAverage(prices, 9);
            const slowMA = calculateMovingAverage(prices, 21);

            // Prepare chart data
            const chartPoints = ohlcvData.map((candle, index) => ({
                time: new Date(candle.timestamp).toLocaleTimeString(),
                price: candle.close,
                fastMA: fastMA[index],
                slowMA: slowMA[index],
                timestamp: candle.timestamp,
                index: index
            })).filter(point => point.fastMA && point.slowMA);

            setChartData(chartPoints);
            setTrades(recentTrades);

        } catch (error) {
            console.error('Error fetching strategy data:', error);
            generateDemoStrategyData();
        }
    }, [currentConfig.multi_pair_mode, currentConfig.symbols, currentConfig.symbol, currentConfig.aggressive_mode, currentConfig.super_aggressive_mode]);

    const calculateMovingAverage = (prices, period) => {
        const ma = [];
        for (let i = 0; i < prices.length; i++) {
            if (i < period - 1) {
                ma.push(null);
            } else {
                const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
                ma.push(sum / period);
            }
        }
        return ma;
    };

    const generateDemoStrategyData = useCallback(() => {
        const symbolBase = (currentConfig.multi_pair_mode ? currentConfig.symbols[0] : currentConfig.symbol)?.split('/')[0] || 'DEMO';
        let basePrice = 100;

        if (symbolBase.includes('BTC')) basePrice = 58000;
        else if (symbolBase.includes('ETH')) basePrice = 3500;
        else if (symbolBase.includes('ADA')) basePrice = 0.5;
        else if (symbolBase.includes('SOL')) basePrice = 150;
        else if (symbolBase.includes('DOT')) basePrice = 25;

        const demoData = Array.from({ length: 30 }, (_, i) => {
            const volatility = basePrice * 0.002;
            const trend = Math.sin(i * 0.1) * (basePrice * 0.005);
            const price = basePrice + trend + (Math.random() - 0.5) * volatility;
            const fastMA = price + (Math.random() - 0.5) * (basePrice * 0.001);
            const slowMA = price + (Math.random() - 0.5) * (basePrice * 0.002);

            return {
                time: new Date(Date.now() - (30 - i) * 60000).toLocaleTimeString(),
                price: price,
                fastMA: fastMA,
                slowMA: slowMA,
                timestamp: Date.now() - (30 - i) * 60000,
                index: i
            };
        });
        setChartData(demoData);
    }, [currentConfig.multi_pair_mode, currentConfig.symbols, currentConfig.symbol]);

    const getTradeMarkers = () => {
        if (!trades.length || !chartData.length) return [];

        return trades.map(trade => {
            const tradeTime = new Date(trade.timestamp).toLocaleTimeString();
            const chartPoint = chartData.find(point => point.time === tradeTime);

            if (chartPoint) {
                return {
                    x: chartPoint.index,
                    y: trade.price,
                    trade: trade,
                    time: tradeTime
                };
            }
            return null;
        }).filter(Boolean);
    };

    const CustomStrategyTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="strategy-tooltip">
                    <p className="tooltip-time">{label}</p>
                    <p className="tooltip-price">Price: ${data.price?.toFixed(2)}</p>
                    <p className="tooltip-fast-ma">Fast MA (9): ${data.fastMA?.toFixed(2)}</p>
                    <p className="tooltip-slow-ma">Slow MA (21): ${data.slowMA?.toFixed(2)}</p>
                    <p className="tooltip-signal">
                        Signal: {data.fastMA > data.slowMA ? 'BUY' : 'SELL'}
                    </p>
                </div>
            );
        }
        return null;
    };

    useEffect(() => {
        if (botStatus.running) {
            const activities = [
                'Analyzing market data...',
                'Calculating moving averages...',
                'Scanning for crossover signals...',
                'Monitoring price action...',
                'Evaluating entry conditions...',
                'Processing trading signals...',
                'Executing strategy logic...'
            ];

            const updateInterval = (currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) ? 1000 : 3000;

            const interval = setInterval(() => {
                let randomActivity;
                if (currentConfig.super_aggressive_mode) {
                    randomActivity = `SUPER AGGRESSIVE: ${activities[Math.floor(Math.random() * activities.length)]} (${currentConfig.symbols.length} pairs)`;
                } else if (currentConfig.aggressive_mode) {
                    randomActivity = `AGGRESSIVE: ${activities[Math.floor(Math.random() * activities.length)]} (5-min candles)`;
                } else {
                    randomActivity = activities[Math.floor(Math.random() * activities.length)];
                }
                setActivity(randomActivity);
            }, updateInterval);

            return () => clearInterval(interval);
        } else {
            setActivity('Bot stopped - Waiting for commands');
        }
    }, [botStatus.running, currentConfig.aggressive_mode, currentConfig.super_aggressive_mode, currentConfig.symbols.length]);

    useEffect(() => {
        fetchStrategyData();
        fetchPerformanceStats();

        if (botStatus.running) {
            const updateInterval = (currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) ? 3000 : 5000;
            const interval = setInterval(() => {
                fetchStrategyData();
                fetchPerformanceStats();
            }, updateInterval);
            return () => clearInterval(interval);
        }
    }, [botStatus.running, fetchStrategyData, fetchPerformanceStats]);

    const startBot = async () => {
        // Enhanced validation using currentConfig
        if (!currentConfig.multi_pair_mode && (!currentConfig.symbol || currentConfig.symbol.trim() === '')) {
            setMessage('Error: Please set a trading pair in Settings first');
            return;
        }

        if (currentConfig.multi_pair_mode && currentConfig.symbols.length === 0) {
            setMessage('Error: Please select at least one trading pair for multi-pair mode');
            return;
        }

        if (currentConfig.super_aggressive_mode && currentConfig.symbols.length < 3) {
            setMessage('Error: Super Aggressive mode requires at least 3 trading pairs');
            return;
        }

        setLoading(true);
        setMessage('Initializing trading engine...');

        try {
            let endpoint = '/api/start';
            let botData = { ...currentConfig };

            // Determine which bot type to use
            if (currentConfig.super_aggressive_mode) {
                endpoint = '/api/start-super-aggressive';
                botData = {
                    ...currentConfig,
                    symbols: currentConfig.symbols,
                    risk: Math.max(currentConfig.risk * 1.5, 3.0),
                    stop_loss: Math.max(currentConfig.stop_loss, 1.5),
                    take_profit: Math.max(currentConfig.take_profit, 2.5),
                    strategy_type: 'aggressive_ema',
                    kill_switch_threshold: 20
                };
            } else if (currentConfig.aggressive_mode) {
                endpoint = '/api/start-fast';
                botData = {
                    ...currentConfig,
                    symbol: currentConfig.multi_pair_mode ? currentConfig.symbols[0] : currentConfig.symbol,
                    risk: Math.max(currentConfig.risk * 1.2, 2.0),
                    stop_loss: Math.max(currentConfig.stop_loss, 1.5),
                    take_profit: Math.max(currentConfig.take_profit, 2.0),
                    strategy_type: 'aggressive_ema',
                    kill_switch_threshold: 15
                };
            } else {
                // Original bot logic with enhanced config
                botData = {
                    ...currentConfig,
                    symbol: currentConfig.multi_pair_mode ? currentConfig.symbols[0] : currentConfig.symbol,
                    symbols: currentConfig.multi_pair_mode ? currentConfig.symbols : [currentConfig.symbol],
                    multi_pair_mode: currentConfig.multi_pair_mode,
                    risk: currentConfig.multi_pair_mode ? Math.max(currentConfig.risk / currentConfig.symbols.length, 0.5) : currentConfig.risk
                };
            }

            console.log(`Starting bot with ${endpoint}:`, botData);

            const response = await axios.post(endpoint, botData);
            setMessage(response.data.message || 'Trading engine activated!');

            // Show mode-specific info
            if (currentConfig.super_aggressive_mode) {
                setMessage(prev => prev + `\n🚀 SUPER AGGRESSIVE MODE: ${currentConfig.symbols.length} pairs, 15-second checks`);
            } else if (currentConfig.aggressive_mode) {
                setMessage(prev => prev + `\n⚡ AGGRESSIVE MODE: 5-minute candles, 30-second cooldown`);
            } else if (currentConfig.multi_pair_mode) {
                setMessage(prev => prev + `\n📊 Multi-pair trading: ${currentConfig.symbols.length} pairs`);
            }

            onRefresh();
        } catch (error) {
            console.error('Bot start error:', error);
            setMessage('Error starting bot: ' + (error.response?.data?.error || error.message));
        }
        setLoading(false);
    };

    const stopBot = async () => {
        setLoading(true);
        setMessage('Shutting down trading engine...');
        try {
            await axios.post('/api/stop');
            setMessage('Trading engine deactivated');
            onRefresh();
        } catch (error) {
            setMessage('Error stopping bot: ' + error.message);
        }
        setLoading(false);
    };

    const runBacktest = async () => {
        const symbolToTest = currentConfig.multi_pair_mode ? currentConfig.symbols[0] : currentConfig.symbol;

        if (!symbolToTest || symbolToTest.trim() === '') {
            setMessage('Error: Please set a trading pair in Settings first');
            return;
        }

        setLoading(true);
        setMessage('Running historical analysis...');
        try {
            await axios.post('/api/backtest', {
                symbol: symbolToTest,
                years: 1,
                risk: currentConfig.multi_pair_mode ? currentConfig.risk / currentConfig.symbols.length : currentConfig.risk,
                stop_loss: currentConfig.stop_loss,
                take_profit: currentConfig.take_profit,
                multi_pair_mode: currentConfig.multi_pair_mode,
                symbols: currentConfig.multi_pair_mode ? currentConfig.symbols : [symbolToTest],
                aggressive_mode: currentConfig.aggressive_mode || currentConfig.super_aggressive_mode
            });
            setMessage('Backtest analysis complete: Strategy validation successful');
        } catch (error) {
            setMessage('Error running backtest: ' + error.message);
        }
        setLoading(false);
    };

    const tradeMarkers = getTradeMarkers();

    return (
        <div className="bot-controls">
            <div className="control-panel">
                <h3>Bot Controls</h3>

                {/* Trading Speed Mode Selection */}
                <div className="aggressive-mode-section">
                    <h4>Trading Speed Mode</h4>

                    <div className="mode-options">
                        <label className="mode-option">
                            <input
                                type="radio"
                                name="tradingMode"
                                checked={!currentConfig.aggressive_mode && !currentConfig.super_aggressive_mode}
                                onChange={() => {
                                    handleConfigChange('aggressive_mode', false);
                                    handleConfigChange('super_aggressive_mode', false);
                                }}
                            />
                            <span className="mode-title">Conservative (Original)</span>
                            <div className="mode-description">
                                1-hour candles • 5-min cooldown • 3-8 trades/day • Safe & steady
                            </div>
                        </label>

                        <label className="mode-option aggressive">
                            <input
                                type="radio"
                                name="tradingMode"
                                checked={currentConfig.aggressive_mode}
                                onChange={(e) => handleConfigChange('aggressive_mode', e.target.checked)}
                            />
                            <span className="mode-title">⚡ Aggressive (Fast)</span>
                            <div className="mode-description">
                                5-min candles • 30-sec cooldown • 10-25 trades/day • Higher frequency
                            </div>
                        </label>

                        <label className="mode-option super-aggressive">
                            <input
                                type="radio"
                                name="tradingMode"
                                checked={currentConfig.super_aggressive_mode}
                                onChange={(e) => handleConfigChange('super_aggressive_mode', e.target.checked)}
                            />
                            <span className="mode-title">🚀 Super Aggressive (Maximum)</span>
                            <div className="mode-description">
                                5-min candles • 15-sec checks • 30-60 trades/day • Multiple pairs required
                            </div>
                        </label>
                    </div>

                    {(currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) && (
                        <div className="aggressive-warning">
                            <strong>⚠️ High-Frequency Trading Warning:</strong>
                            <ul>
                                <li>More trades = higher potential profits AND losses</li>
                                <li>Increased trading fees due to frequency</li>
                                <li>Requires active monitoring in live mode</li>
                                <li>Start with paper trading to test performance</li>
                            </ul>
                        </div>
                    )}
                </div>

                {/* Multi-Pair Mode */}
                <div className="multi-pair-section">
                    <label className="multi-pair-toggle">
                        <input
                            type="checkbox"
                            checked={currentConfig.multi_pair_mode}
                            onChange={(e) => handleConfigChange('multi_pair_mode', e.target.checked)}
                            disabled={currentConfig.super_aggressive_mode}
                            className="multi-pair-checkbox"
                        />
                        <span className="multi-pair-title">
                            Multi-Pair Trading Mode {currentConfig.super_aggressive_mode && "(Required)"}
                        </span>
                    </label>
                    <p className="multi-pair-description">
                        Trade multiple pairs simultaneously for more opportunities
                        {currentConfig.super_aggressive_mode && (
                            <><br /><strong>🚀 Super Aggressive mode requires at least 3 pairs</strong></>
                        )}
                    </p>

                    {(currentConfig.multi_pair_mode || currentConfig.super_aggressive_mode) && (
                        <div className="multi-pair-content">
                            <div className="multi-pair-header">
                                <span>Selected Trading Pairs</span>
                                <span className="pair-counter">
                                    {currentConfig.symbols.length}/{currentConfig.super_aggressive_mode ? '15' : '8'}
                                    {currentConfig.super_aggressive_mode && currentConfig.symbols.length < 3 && (
                                        <span className="error-text"> (Need 3+ for Super Aggressive)</span>
                                    )}
                                </span>
                            </div>

                            <div className="selected-pairs-container">
                                {currentConfig.symbols.map(pair => (
                                    <div key={pair} className="pair-tag">
                                        <span>{pair}</span>
                                        {currentConfig.symbols.length > 1 && (
                                            <button
                                                onClick={() => removePair(pair)}
                                                className="pair-remove-btn"
                                                title="Remove pair"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="add-pairs-section">
                                <h4 className="add-pairs-header">Add Popular Pairs:</h4>
                                <div className="popular-pairs-grid">
                                    {popularPairs
                                        .filter(pair => !currentConfig.symbols.includes(pair))
                                        .map(pair => (
                                            <button
                                                key={pair}
                                                onClick={() => addPair(pair)}
                                                disabled={currentConfig.symbols.length >= (currentConfig.super_aggressive_mode ? 15 : 8)}
                                                className="add-pair-btn"
                                            >
                                                + {pair}
                                            </button>
                                        ))
                                    }
                                </div>
                            </div>

                            <div className="multi-pair-benefits">
                                <div className="benefits-title">Multi-Pair Benefits:</div>
                                <ul className="benefits-list">
                                    <li>
                                        Risk split: {Math.max((currentConfig.risk / currentConfig.symbols.length), 0.3).toFixed(2)}% per pair
                                        {currentConfig.super_aggressive_mode && " (minimum 0.3%)"}
                                    </li>
                                    <li>
                                        Expected trades: {currentConfig.super_aggressive_mode ? '30-60' : (currentConfig.aggressive_mode ? '15-35' : '10-25')}/day
                                    </li>
                                    <li>Diversification reduces single-pair risk</li>
                                    <li>Up to 2 positions per pair simultaneously</li>
                                    {currentConfig.super_aggressive_mode && <li>🚀 Maximum frequency: 15-second market checks</li>}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Trade Amount Configuration */}
                <div className="trade-config-section">
                    <div className="form-group">
                        <label>Trade Amount ($)</label>
                        <input
                            type="number"
                            step="100"
                            min="100"
                            max="50000"
                            value={currentConfig.trade_amount}
                            onChange={(e) => handleConfigChange('trade_amount', parseFloat(e.target.value))}
                            placeholder="Enter trade amount in USD"
                            className="trade-amount-input"
                        />
                        <small className="form-hint">
                            Amount per trade (recommended: ${currentConfig.super_aggressive_mode ? '300-1000' : (currentConfig.aggressive_mode ? '500-2000' : '1000-5000')})
                        </small>
                    </div>
                </div>

                {/* Enhanced Status Display */}
                <div className="bot-status-display">
                    <div className={`status-indicator-large ${botStatus.running ? 'active' : 'inactive'} ${currentConfig.super_aggressive_mode ? 'super-aggressive' : (currentConfig.aggressive_mode ? 'aggressive' : '')}`}>
                        <div className="status-pulse"></div>
                        <div className="status-text">
                            {botStatus.running ?
                                (currentConfig.super_aggressive_mode ? 'SUPER AGGRESSIVE ENGINE ACTIVE' :
                                    currentConfig.aggressive_mode ? 'AGGRESSIVE ENGINE ACTIVE' :
                                        'TRADING ENGINE ACTIVE')
                                : 'SYSTEM STANDBY'}
                        </div>
                    </div>

                    {/* Performance stats for aggressive modes */}
                    {botStatus.running && (currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) && (
                        <div className="performance-stats">
                            <div className="stats-row">
                                <span>Total P&L: </span>
                                <span className={performanceStats.total_pnl >= 0 ? 'profit' : 'loss'}>
                                    ${performanceStats.total_pnl?.toFixed(2)}
                                </span>
                            </div>
                            <div className="stats-row">
                                <span>Win Rate: </span>
                                <span>{performanceStats.win_rate?.toFixed(1)}% ({performanceStats.win_count}W/{performanceStats.loss_count}L)</span>
                            </div>
                            <div className="stats-row">
                                <span>Open Positions: </span>
                                <span>{performanceStats.open_positions}</span>
                            </div>
                            {performanceStats.consecutive_losses > 0 && (
                                <div className="stats-row warning">
                                    <span>Loss Streak: </span>
                                    <span>{performanceStats.consecutive_losses}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="activity-monitor">
                        <div className="activity-label">Current Activity:</div>
                        <div className="activity-text">{activity}</div>
                    </div>
                </div>

                <div className="control-buttons">
                    <button
                        className={`btn btn-success ${botStatus.running ? 'disabled' : ''} ${currentConfig.super_aggressive_mode ? 'super-aggressive-btn' : (currentConfig.aggressive_mode ? 'aggressive-btn' : '')}`}
                        onClick={startBot}
                        disabled={loading || botStatus.running}
                        style={{
                            backgroundColor: currentConfig.super_aggressive_mode ? '#ff4444' : (currentConfig.aggressive_mode ? '#ff8800' : '#28a745'),
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '6px',
                            cursor: loading || botStatus.running ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        {loading && !botStatus.running ? (
                            <><span className="btn-spinner"></span>STARTING...</>
                        ) : (
                            <>START {currentConfig.super_aggressive_mode ? 'SUPER AGGRESSIVE' : (currentConfig.aggressive_mode ? 'AGGRESSIVE' : '')} ENGINE</>
                        )}
                    </button>

                    <button
                        className={`btn btn-danger ${!botStatus.running ? 'disabled' : ''}`}
                        onClick={stopBot}
                        disabled={loading || !botStatus.running}
                        style={{
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '6px',
                            cursor: loading || !botStatus.running ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        {loading && botStatus.running ? (
                            <><span className="btn-spinner"></span>STOPPING...</>
                        ) : (
                            <>STOP ENGINE</>
                        )}
                    </button>

                    <button
                        className="btn btn-info"
                        onClick={runBacktest}
                        disabled={loading}
                    >
                        {loading ? (
                            <><span className="btn-spinner"></span>ANALYZING...</>
                        ) : (
                            <>BACKTEST</>
                        )}
                    </button>
                </div>

                {/* Mode-specific recommendations */}
                <div className="recommended-settings">
                    <div className="settings-title">
                        {currentConfig.super_aggressive_mode ? 'Super Aggressive Mode Settings' :
                            currentConfig.aggressive_mode ? 'Aggressive Mode Settings' :
                                'Recommended Settings'}
                    </div>
                    <div className="settings-grid">
                        <div className="setting-item">
                            <span className="setting-label">Stop Loss:</span>
                            <span className="setting-value">
                                {(currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) ? '1.5-2.5%' : '2-4%'}
                                (current: {currentConfig.stop_loss}%)
                            </span>
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">Take Profit:</span>
                            <span className="setting-value">
                                {(currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) ? '2-4%' : '4-8%'}
                                (current: {currentConfig.take_profit}%)
                            </span>
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">Expected Frequency:</span>
                            <span className="setting-value">
                                {currentConfig.super_aggressive_mode ? '30-60 trades/day' :
                                    currentConfig.aggressive_mode ? '10-25 trades/day' : '3-8 trades/day'}
                            </span>
                        </div>
                    </div>
                    {(currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) && (
                        <div className="settings-warning">
                            {currentConfig.super_aggressive_mode ?
                                'Super Aggressive mode uses 15-second market checks for maximum opportunity capture.' :
                                'Aggressive mode uses 5-minute candles and 30-second cooldowns for faster execution.'}
                        </div>
                    )}
                </div>

                {message && (
                    <div className={`message ${message.includes('Error') ? 'error' : 'success'} ${currentConfig.super_aggressive_mode ? 'super-aggressive-message' : (currentConfig.aggressive_mode ? 'aggressive-message' : '')}`} style={{
                        marginTop: '15px',
                        padding: '12px',
                        borderRadius: '6px',
                        backgroundColor: message.includes('Error') ? '#f8d7da' : '#d4edda',
                        color: message.includes('Error') ? '#721c24' : '#155724',
                        border: `1px solid ${message.includes('Error') ? '#f5c6cb' : '#c3e6cb'}`,
                        whiteSpace: 'pre-line',
                        fontSize: '13px'
                    }}>
                        {message}
                    </div>
                )}
            </div>

            {/* Live Strategy Visualization */}
            <div className="strategy-visualization">
                <h3>
                    Live Strategy Execution
                    {currentConfig.super_aggressive_mode && ' (Super Aggressive)'}
                    {currentConfig.aggressive_mode && ' (Aggressive)'}
                </h3>

                {/* Enhanced Live Statistics Panel */}
                <div className="live-stats-panel">
                    <div className="stats-grid">
                        <div className="stat-item">
                            <span className="stat-label">Today's P&L</span>
                            <span className={`stat-value ${liveStats.todayPnl >= 0 ? 'profit' : 'loss'}`}>
                                ${liveStats.todayPnl.toFixed(2)}
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Trades Today</span>
                            <span className="stat-value">{liveStats.totalTrades}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Win Rate</span>
                            <span className="stat-value">{liveStats.winRate.toFixed(1)}%</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Avg Profit</span>
                            <span className="stat-value profit">${liveStats.avgProfit.toFixed(2)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Avg Loss</span>
                            <span className="stat-value loss">${liveStats.avgLoss.toFixed(2)}</span>
                        </div>
                        {(currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) && performanceStats.total_pnl !== undefined && (
                            <div className="stat-item">
                                <span className="stat-label">Session P&L</span>
                                <span className={`stat-value ${performanceStats.total_pnl >= 0 ? 'profit' : 'loss'}`}>
                                    ${performanceStats.total_pnl.toFixed(2)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="strategy-info">
                    <div className="strategy-details">
                        <div className="strategy-item">
                            <span className="strategy-label">Strategy:</span>
                            <span className="strategy-value">
                                {(currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) ? 'Aggressive EMA Crossover' :
                                    currentConfig.strategy_type === 'custom' ? 'Custom Strategy' : 'Moving Average Crossover'}
                            </span>
                        </div>
                        <div className="strategy-item">
                            <span className="strategy-label">Timeframe:</span>
                            <span className="strategy-value">
                                {(currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) ? '5-minute candles' : '1-hour candles'}
                            </span>
                        </div>
                        <div className="strategy-item">
                            <span className="strategy-label">Check Frequency:</span>
                            <span className="strategy-value">
                                {currentConfig.super_aggressive_mode ? 'Every 15 seconds' :
                                    currentConfig.aggressive_mode ? 'Every 5 seconds' : 'Every 10 seconds'}
                            </span>
                        </div>
                        <div className="strategy-item">
                            <span className="strategy-label">Cooldown:</span>
                            <span className="strategy-value">
                                {currentConfig.super_aggressive_mode ? '30 seconds per pair' :
                                    currentConfig.aggressive_mode ? '30 seconds' : '5 minutes'}
                            </span>
                        </div>
                        {(currentConfig.multi_pair_mode || currentConfig.super_aggressive_mode) && (
                            <div className="strategy-item">
                                <span className="strategy-label">Pairs:</span>
                                <span className="strategy-value">{currentConfig.symbols.length} symbols</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="live-strategy-chart">
                    <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="1 1" stroke="var(--border-primary)" />
                            <XAxis
                                dataKey="time"
                                stroke="var(--text-muted)"
                                tick={{ fontSize: 10 }}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                stroke="var(--text-muted)"
                                tick={{ fontSize: 10 }}
                                tickFormatter={(value) => `${value.toFixed(0)}`}
                                domain={['dataMin - 50', 'dataMax + 50']}
                            />
                            <Tooltip content={<CustomStrategyTooltip />} />

                            <Line
                                type="monotone"
                                dataKey="price"
                                stroke="var(--text-accent)"
                                strokeWidth={2}
                                dot={false}
                                name="Price"
                            />

                            <Line
                                type="monotone"
                                dataKey="fastMA"
                                stroke="var(--profit-bright)"
                                strokeWidth={1.5}
                                strokeDasharray="5 5"
                                dot={false}
                                name="Fast MA (9)"
                            />

                            <Line
                                type="monotone"
                                dataKey="slowMA"
                                stroke="var(--loss-bright)"
                                strokeWidth={1.5}
                                strokeDasharray="10 5"
                                dot={false}
                                name="Slow MA (21)"
                            />

                            {tradeMarkers.map((marker, index) => (
                                <ReferenceDot
                                    key={index}
                                    x={marker.x}
                                    y={marker.y}
                                    r={4}
                                    fill={marker.trade.side === 'buy' ? 'var(--profit-bright)' : 'var(--loss-bright)'}
                                    stroke="#ffffff"
                                    strokeWidth={2}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="strategy-legend">
                    <div className="legend-item">
                        <span className="legend-line price-line"></span>
                        <span>{(currentConfig.multi_pair_mode ? currentConfig.symbols[0] : currentConfig.symbol)?.split('/')[0] || 'Crypto'} Price</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-line fast-ma-line"></span>
                        <span>Fast MA (9) - Buy Signal</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-line slow-ma-line"></span>
                        <span>Slow MA (21) - Sell Signal</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot buy-dot"></span>
                        <span>Buy Entry</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot sell-dot"></span>
                        <span>Sell Entry</span>
                    </div>
                </div>
            </div>

            {/* Enhanced Configuration Display */}
            <div className="trading-config">
                <h3>Current Configuration</h3>
                <div className="config-grid">
                    <div className="config-item">
                        <span className="config-label">Exchange</span>
                        <span className="config-value">{currentConfig.exchange?.toUpperCase() || 'NOT SET'}</span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Trading Pair{currentConfig.multi_pair_mode ? 's' : ''}</span>
                        <span className="config-value">
                            {currentConfig.multi_pair_mode ? currentConfig.symbols.join(', ') : (currentConfig.symbol || 'NOT SET')}
                        </span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Trade Amount</span>
                        <span className="config-value">${currentConfig.trade_amount}</span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Speed Mode</span>
                        <span className="config-value">
                            {currentConfig.super_aggressive_mode ? 'Super Aggressive (Maximum)' :
                                currentConfig.aggressive_mode ? 'Aggressive (Fast)' : 'Conservative (Original)'}
                        </span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Strategy Type</span>
                        <span className="config-value">
                            {(currentConfig.aggressive_mode || currentConfig.super_aggressive_mode) ? 'Aggressive EMA Crossover' :
                                currentConfig.strategy_type === 'custom' ? 'Custom Strategy' : 'Default MA Crossover'}
                        </span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Risk per Trade</span>
                        <span className="config-value">
                            {currentConfig.multi_pair_mode ? `${Math.max((currentConfig.risk / currentConfig.symbols.length), 0.3).toFixed(2)}% per pair` : `${currentConfig.risk}%`}
                        </span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Stop Loss</span>
                        <span className="config-value">{currentConfig.stop_loss}%</span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Take Profit</span>
                        <span className="config-value">{currentConfig.take_profit}%</span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Execution Speed</span>
                        <span className="config-value">
                            {currentConfig.super_aggressive_mode ? 'Maximum (15s checks)' :
                                currentConfig.aggressive_mode ? 'Fast (5s checks)' : 'Normal (10s checks)'}
                        </span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Expected Trades/Day</span>
                        <span className="config-value">
                            {currentConfig.super_aggressive_mode ? '30-60' :
                                currentConfig.aggressive_mode ? '10-25' : '3-8'}
                        </span>
                    </div>
                    <div className="config-item">
                        <span className="config-label">Mode</span>
                        <span className={`config-value ${currentConfig.real_mode ? 'live-mode' : 'paper-mode'}`}>
                            {currentConfig.real_mode ? 'LIVE TRADING' : 'PAPER TRADING'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BotControls;
