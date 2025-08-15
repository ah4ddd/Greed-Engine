import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import axios from 'axios';

function LiveChart({ symbol, trades }) {
    const [chartData, setChartData] = useState([]);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [priceChange, setPriceChange] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [marketData, setMarketData] = useState({});
    const [recentTrade, setRecentTrade] = useState(null);
    const intervalRef = useRef();

    const fetchRealMarketData = async () => {
        try {
            // Fetch real Bitcoin market data
            const response = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin');
            const data = await response.json();

            setMarketData({
                volume: `$${(data.market_data.total_volume.usd / 1e9).toFixed(1)}B`,
                marketCap: `$${(data.market_data.market_cap.usd / 1e12).toFixed(2)}T`,
                supply: `${(data.market_data.circulating_supply / 1e6).toFixed(1)}M BTC`
            });
        } catch (error) {
            console.log('Using fallback market data');
            setMarketData({
                volume: '$28.5B',
                marketCap: '$1.15T',
                supply: '19.7M BTC'
            });
        }
    };

    const updateChart = async () => {
        try {
            const response = await axios.get(`/api/ohlcv?symbol=${symbol}&timeframe=1m&limit=50`);
            const newData = response.data.data.map((candle, index) => ({
                time: new Date(candle.timestamp).toLocaleTimeString(),
                price: candle.close,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                volume: candle.volume,
                timestamp: candle.timestamp,
                index: index
            }));

            setChartData(newData);

            if (newData.length > 1) {
                const current = newData[newData.length - 1].price;
                const previous = newData[newData.length - 2].price;
                setCurrentPrice(current);
                setPriceChange(((current - previous) / previous * 100));
            }

            if (isLoading) setIsLoading(false);
        } catch (error) {
            console.error('Error fetching OHLCV data:', error);

            // Generate realistic Bitcoin-like demo data
            const generateBitcoinData = () => {
                const basePrice = 58500;
                return Array.from({ length: 40 }, (_, i) => {
                    const volatility = 150;
                    const trend = Math.sin(i * 0.03) * 800;
                    const noise = (Math.random() - 0.5) * volatility;
                    const price = basePrice + trend + noise + (i * 5);

                    return {
                        time: new Date(Date.now() - (40 - i) * 60000).toLocaleTimeString(),
                        price: price,
                        open: price + (Math.random() - 0.5) * 50,
                        high: price + Math.random() * 100,
                        low: price - Math.random() * 100,
                        volume: Math.random() * 1000,
                        timestamp: Date.now() - (40 - i) * 60000,
                        index: i
                    };
                });
            };

            const demoData = generateBitcoinData();
            setChartData(demoData);
            setCurrentPrice(demoData[demoData.length - 1].price);
            setPriceChange(Math.random() * 2 - 0.5);
            setIsLoading(false);
        }
    };

    // Detect new trades and show animation
    useEffect(() => {
        if (trades.length > 0) {
            const latestTrade = trades[trades.length - 1];
            const tradeTime = new Date(latestTrade.timestamp).getTime();
            const now = Date.now();

            // If trade is within last 10 seconds, show animation
            if (now - tradeTime < 10000) {
                setRecentTrade(latestTrade);
                setTimeout(() => setRecentTrade(null), 5000); // Hide after 5 seconds
            }
        }
    }, [trades]);

    useEffect(() => {
        updateChart();
        fetchRealMarketData();
        intervalRef.current = setInterval(() => {
            updateChart();
            fetchRealMarketData();
        }, 20000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [symbol]);

    const getTradeMarkers = () => {
        if (!trades || trades.length === 0) return [];

        return trades.slice(-5).map((trade, index) => {
            const tradeTime = new Date(trade.timestamp).toLocaleTimeString();
            const dataPoint = chartData.find(d => d.time === tradeTime);

            if (dataPoint) {
                return {
                    x: dataPoint.index,
                    y: trade.price,
                    trade: trade
                };
            }
            return null;
        }).filter(Boolean);
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="custom-tooltip">
                    <p className="tooltip-time">{label}</p>
                    <p className="tooltip-price">Price: ${data.price.toFixed(2)}</p>
                    <p className="tooltip-high">High: ${data.high.toFixed(2)}</p>
                    <p className="tooltip-low">Low: ${data.low.toFixed(2)}</p>
                </div>
            );
        }
        return null;
    };

    if (isLoading) {
        return (
            <div className="live-chart">
                <div className="chart-header">
                    <h3>{symbol} Live Chart</h3>
                    <div className="loading">Loading market data...</div>
                </div>
                <div className="chart-loading">
                    <div className="loading-spinner"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="live-chart">
            {/* Recent Trade Alert */}
            {recentTrade && (
                <div className={`trade-alert ${recentTrade.side}`}>
                    <div className="alert-content">
                        <span className="alert-icon">
                            {recentTrade.side === 'buy' ? '📈' : '📉'}
                        </span>
                        <span className="alert-text">
                            {recentTrade.side.toUpperCase()} executed at ${recentTrade.price?.toFixed(2)}
                        </span>
                        <span className="alert-pnl">
                            P&L: {recentTrade.pnl >= 0 ? '+' : ''}${recentTrade.pnl?.toFixed(2)}
                        </span>
                    </div>
                </div>
            )}

            <div className="chart-header">
                <div className="chart-title">
                    <h3>{symbol}</h3>
                    <span className="chart-subtitle">Live Price Chart</span>
                </div>
                <div className="price-info">
                    <div className="current-price">
                        ${currentPrice.toFixed(2)}
                    </div>
                    <div className={`price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                        {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
                    </div>
                </div>
            </div>

            <div className="chart-container">
                <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="1 1" stroke="#2d2f36" />
                        <XAxis
                            dataKey="time"
                            stroke="#8b949e"
                            tick={{ fontSize: 11 }}
                            axisLine={{ stroke: '#2d2f36' }}
                        />
                        <YAxis
                            stroke="#8b949e"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(value) => `$${value.toLocaleString()}`}
                            axisLine={{ stroke: '#2d2f36' }}
                            domain={['dataMin - 200', 'dataMax + 200']}
                        />
                        <Tooltip content={<CustomTooltip />} />

                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#00d4ff"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorPrice)"
                            dot={false}
                            activeDot={{ r: 4, fill: '#00d4ff', stroke: '#ffffff', strokeWidth: 2 }}
                        />

                        {/* Trade Markers */}
                        {getTradeMarkers().map((marker, index) => (
                            <ReferenceDot
                                key={index}
                                x={marker.x}
                                y={marker.y}
                                r={6}
                                fill={marker.trade.side === 'buy' ? '#26d665' : '#ff6b6b'}
                                stroke="#ffffff"
                                strokeWidth={2}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="market-indicators">
                <div className="indicator">
                    <span className="indicator-label">24h Volume</span>
                    <span className="indicator-value">{marketData.volume || 'Loading...'}</span>
                </div>
                <div className="indicator">
                    <span className="indicator-label">Market Cap</span>
                    <span className="indicator-value">{marketData.marketCap || 'Loading...'}</span>
                </div>
                <div className="indicator">
                    <span className="indicator-label">Circulating Supply</span>
                    <span className="indicator-value">{marketData.supply || 'Loading...'}</span>
                </div>
            </div>

            {/* Recent Signals - FIXED TO SHOW ACTUAL LATEST TRADES */}
            {trades && trades.length > 0 && (
                <div className="recent-signals">
                    <h4>Recent Signals</h4>
                    <div className="signals-container">
                        {/* Use the trades passed from Dashboard (already sorted latest first) */}
                        {trades.slice(0, 4).map((trade, index) => (
                            <div key={trade.id || `${trade.timestamp}-${index}`} className={`signal-pill ${trade.side} ${trade.pnl < 0 ? 'loss-signal' : 'profit-signal'}`}>
                                <span className="signal-icon">
                                    {trade.side === 'buy' ? '🟢' : '🔴'}
                                </span>
                                <span className="signal-text">
                                    {trade.side.toUpperCase()} ${trade.price?.toFixed(2)}
                                </span>
                                <span className={`signal-pnl ${trade.pnl >= 0 ? 'profit' : 'loss'}`}>
                                    {trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)}` : `$${trade.pnl.toFixed(2)}`}
                                </span>
                                <span className="signal-time">
                                    {new Date(trade.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default LiveChart;
