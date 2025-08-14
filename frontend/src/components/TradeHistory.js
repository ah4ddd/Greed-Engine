import React, { useState } from 'react';

function TradeHistory({ trades }) {
    const [showDetails, setShowDetails] = useState(false);

    const calculateStats = () => {
        const closedTrades = trades.filter(trade => trade.status === 'EXECUTED');
        const winningTrades = closedTrades.filter(trade => trade.pnl > 0);
        const losingTrades = closedTrades.filter(trade => trade.pnl < 0);

        // Fix: Calculate total trading volume, not accumulated capital
        const totalTradingVolume = closedTrades.reduce((sum, trade) => sum + (trade.price * trade.size), 0);
        const totalPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);

        // Calculate profit factor properly
        const totalWins = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
        const totalLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));

        return {
            winRate: closedTrades.length > 0 ? ((winningTrades.length / closedTrades.length) * 100).toFixed(1) : 0,
            totalTrades: closedTrades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            totalCapital: totalTradingVolume, // This is total volume traded
            totalPnL: totalPnL,
            profitFactor: totalLosses > 0 ? (totalWins / totalLosses).toFixed(2) : 'N/A'
        };
    };

    const stats = calculateStats();

    return (
        <div className="trade-history">
            <div className="history-header">
                <h3>Trade History</h3>
                <div className="history-controls">
                    <button
                        className={`toggle-btn ${showDetails ? 'active' : ''}`}
                        onClick={() => setShowDetails(!showDetails)}
                    >
                        {showDetails ? 'Simple View' : 'Detailed View'}
                    </button>
                </div>
            </div>

            <div className="history-stats-grid">
                <div className="stat-card">
                    <span className="stat-label">Total P&L</span>
                    <span className={`stat-value ${stats.totalPnL >= 0 ? 'profit' : 'loss'}`}>
                        {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
                    </span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Win Rate</span>
                    <span className="stat-value">{stats.winRate}%</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Trading Volume</span>
                    <span className="stat-value">${stats.totalCapital.toFixed(0)}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Profit Factor</span>
                    <span className="stat-value">{stats.profitFactor}</span>
                </div>
            </div>

            <div className="trades-table">
                <div className="table-header">
                    <span>Symbol</span>
                    <span>Side</span>
                    <span>Size</span>
                    <span>Price</span>
                    <span>Capital Used</span>
                    <span>P&L</span>
                    <span>ROI %</span>
                    {showDetails && (
                        <>
                            <span>Stop Loss</span>
                            <span>Take Profit</span>
                            <span>Status</span>
                        </>
                    )}
                    <span>Time</span>
                </div>

                <div className="table-body">
                    {trades.map((trade, index) => {
                        const capitalUsed = trade.price * trade.size;
                        const roi = capitalUsed > 0 ? ((trade.pnl / capitalUsed) * 100) : 0;

                        return (
                            <div key={index} className={`table-row ${trade.pnl >= 0 ? 'profit-row' : 'loss-row'}`}>
                                <span className="symbol-cell">{trade.symbol}</span>
                                <span className={`side-cell ${trade.side}`}>
                                    <span className="side-indicator"></span>
                                    {trade.side.toUpperCase()}
                                </span>
                                <span>{trade.size?.toFixed(4)}</span>
                                <span>${trade.price?.toFixed(2)}</span>
                                <span className="capital-cell">${capitalUsed.toFixed(2)}</span>
                                <span className={`pnl-cell ${trade.pnl >= 0 ? 'profit' : 'loss'}`}>
                                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl?.toFixed(2)}
                                </span>
                                <span className={`roi-cell ${roi >= 0 ? 'profit' : 'loss'}`}>
                                    {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                                </span>
                                {showDetails && (
                                    <>
                                        <span>{trade.stop_loss}%</span>
                                        <span>{trade.take_profit}%</span>
                                        <span className={`status ${trade.status.toLowerCase()}`}>
                                            {trade.status}
                                        </span>
                                    </>
                                )}
                                <span className="time-cell">{new Date(trade.timestamp).toLocaleTimeString()}</span>
                            </div>
                        );
                    })}

                    {trades.length === 0 && (
                        <div className="no-data">
                            <div className="empty-state">
                                <div className="empty-icon">📊</div>
                                <p>No trades yet</p>
                                <span>Start the bot to begin trading!</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default TradeHistory;
