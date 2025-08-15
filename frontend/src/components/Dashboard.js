import React from 'react';
import LiveChart from './LiveChart';

function Dashboard({ balance, trades, currentSymbol = 'BTC/USDT' }) {

    // Calculate stats EXACTLY like trade history does
    const calculateStats = () => {
        if (trades.length === 0) {
            return {
                totalPnL: 0,
                winRate: 0,
                totalTrades: 0,
                currentBalance: 10000
            };
        }

        const executedTrades = trades.filter(trade => trade.status === 'EXECUTED');
        const winningTrades = executedTrades.filter(trade => trade.pnl > 0);
        const totalPnL = executedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        const winRate = executedTrades.length > 0 ? ((winningTrades.length / executedTrades.length) * 100) : 0;

        // Current balance = starting balance + total P&L
        const currentBalance = 10000 + totalPnL;

        return {
            totalPnL: totalPnL,
            winRate: winRate,
            totalTrades: executedTrades.length,
            currentBalance: currentBalance
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

            {/* Live Chart - Pass the LATEST trades */}
            <LiveChart symbol={currentSymbol} trades={latestTrades} />

            <div className="recent-trades">
                <h3>Recent Trades</h3>
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
                        <div className="no-trades">No trades yet - Start the bot to begin trading!</div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
