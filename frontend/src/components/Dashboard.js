import React, { useState, useEffect } from 'react';
import LiveChart from './LiveChart';

function Dashboard({ balance, trades, currentSymbol = 'BTC/USDT' }) {
    const [tradingMode, setTradingMode] = useState('paper');
    const [databaseStats, setDatabaseStats] = useState(null);
    const [switching, setSwitching] = useState(false);

    // Fetch current trading mode on component mount
    useEffect(() => {
        fetchTradingMode();
        fetchDatabaseStats();
    }, []);

    const fetchTradingMode = async () => {
        try {
            const response = await fetch('/api/trading-mode');
            const data = await response.json();
            setTradingMode(data.mode);
        } catch (error) {
            console.error('Error fetching trading mode:', error);
        }
    };

    const fetchDatabaseStats = async () => {
        try {
            const response = await fetch('/api/database-stats');
            const data = await response.json();
            setDatabaseStats(data);
        } catch (error) {
            console.error('Error fetching database stats:', error);
        }
    };

    const handleModeSwitch = async (newMode) => {
        if (switching || newMode === tradingMode) return;

        setSwitching(true);
        try {
            const response = await fetch('/api/trading-mode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mode: newMode }),
            });

            const data = await response.json();
            if (response.ok) {
                setTradingMode(newMode);
                // Refresh the page to reload data from the new database
                window.location.reload();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error('Error switching trading mode:', error);
            alert('Error switching trading mode');
        } finally {
            setSwitching(false);
        }
    };

    // Calculate comprehensive stats including Risk-Reward Ratio
    const calculateStats = () => {
        if (trades.length === 0) {
            return {
                totalPnL: 0,
                winRate: 0,
                totalTrades: 0,
                currentBalance: 10000,
                riskRewardRatio: 0,
                profitFactor: 0,
                averageWin: 0,
                averageLoss: 0
            };
        }

        const executedTrades = trades.filter(trade => trade.status === 'EXECUTED');
        const winningTrades = executedTrades.filter(trade => trade.pnl > 0);
        const losingTrades = executedTrades.filter(trade => trade.pnl < 0);

        const totalPnL = executedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        const winRate = executedTrades.length > 0 ? ((winningTrades.length / executedTrades.length) * 100) : 0;

        // Calculate averages
        const totalWins = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
        const totalLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));
        const averageWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
        const averageLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

        // Risk-Reward Ratio
        const riskRewardRatio = averageLoss > 0 ? averageWin / averageLoss : 0;

        // Profit Factor
        const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

        // Current balance = starting balance + total P&L
        const currentBalance = 10000 + totalPnL;

        return {
            totalPnL: totalPnL,
            winRate: winRate,
            totalTrades: executedTrades.length,
            currentBalance: currentBalance,
            riskRewardRatio: riskRewardRatio,
            profitFactor: profitFactor,
            averageWin: averageWin,
            averageLoss: averageLoss
        };
    };

    // Get the ACTUAL latest trades from history - properly sorted by timestamp
    const getLatestTrades = () => {
        if (!trades || trades.length === 0) return [];

        // Sort trades by timestamp (latest first) and take the first 5
        const sortedTrades = [...trades].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return sortedTrades.slice(0, 5);
    };

    const stats = calculateStats();
    const latestTrades = getLatestTrades();

    return (
        <div className="dashboard">
            {/* NEW: Trading Mode Switcher */}
            <div className="trading-mode-switcher">
                <h3>Trading Mode</h3>
                <div className="mode-buttons">
                    <button
                        className={`mode-btn ${tradingMode === 'paper' ? 'active' : ''}`}
                        onClick={() => handleModeSwitch('paper')}
                        disabled={switching}
                    >
                        Paper Trading
                        {databaseStats && (
                            <span className="mode-stats">
                                {databaseStats.paper.trade_count} trades
                            </span>
                        )}
                    </button>
                    <button
                        className={`mode-btn ${tradingMode === 'live' ? 'active' : ''}`}
                        onClick={() => handleModeSwitch('live')}
                        disabled={switching}
                    >
                        Live Trading
                        {databaseStats && (
                            <span className="mode-stats">
                                {databaseStats.live.trade_count} trades
                            </span>
                        )}
                    </button>
                </div>
                {switching && <div className="switching-indicator">Switching modes...</div>}
                <div className="current-mode-indicator">
                    Currently viewing: <strong>{tradingMode.toUpperCase()}</strong> trading data
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <h3>Account Balance</h3>
                    <div className="stat-value">${stats.currentBalance.toFixed(2)}</div>
                </div>
                <div className="stat-card">
                    <h3>Total Trades</h3>
                    <div className="stat-value">{stats.totalTrades}</div>
                </div>
                <div className="stat-card">
                    <h3>P&L</h3>
                    <div className={`stat-value ${stats.totalPnL >= 0 ? 'profit' : 'loss'}`}>
                        {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
                    </div>
                </div>
                <div className="stat-card">
                    <h3>Win Rate</h3>
                    <div className="stat-value">
                        {stats.winRate.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Enhanced Performance Metrics */}
            <div className="performance-metrics">
                <div className="metrics-grid">
                    <div className="metric-card">
                        <div className="metric-label">Risk-Reward Ratio</div>
                        <div className="metric-value risk-reward">
                            {stats.riskRewardRatio > 0 ? `${stats.riskRewardRatio.toFixed(2)}:1` : 'N/A'}
                        </div>
                        <div className="metric-subtitle">Per $1 risked</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Profit Factor</div>
                        <div className="metric-value profit-factor">
                            {stats.profitFactor.toFixed(2)}
                        </div>
                        <div className="metric-subtitle">Total gains/losses</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Average Win</div>
                        <div className="metric-value avg-win">
                            ${stats.averageWin.toFixed(2)}
                        </div>
                        <div className="metric-subtitle">Per winning trade</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-label">Average Loss</div>
                        <div className="metric-value avg-loss">
                            ${stats.averageLoss.toFixed(2)}
                        </div>
                        <div className="metric-subtitle">Per losing trade</div>
                    </div>
                </div>
            </div>

            {/* Live Chart */}
            <LiveChart symbol={currentSymbol} trades={latestTrades} />

            <div className="recent-trades">
                <h3>Recent Trades ({tradingMode.toUpperCase()})</h3>
                <div className="trades-list">
                    {latestTrades.map((trade, index) => (
                        <div key={trade.id || `${trade.timestamp}-${index}`} className={`trade-item ${trade.pnl >= 0 ? 'profit-trade' : 'loss-trade'}`}>
                            <span className="trade-symbol">{trade.symbol}</span>
                            <span className={`trade-side ${trade.side}`}>{trade.side.toUpperCase()}</span>
                            <span className="trade-size">{trade.size?.toFixed(4)}</span>
                            <span className="trade-price">${trade.price?.toFixed(2)}</span>
                            <span className={`trade-pnl ${trade.pnl >= 0 ? 'profit' : 'loss'}`}>
                                {trade.pnl >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)}
                            </span>
                            <span className="trade-time">
                                {new Date(trade.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                    ))}
                    {latestTrades.length === 0 && (
                        <div className="no-trades">No trades yet in {tradingMode.toUpperCase()} mode - Start the bot to begin trading!</div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
