import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';

function LiveChart({ symbol = 'BTC/USDT', trades = [] }) {
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPrice, setCurrentPrice] = useState(null);

    useEffect(() => {
        console.log('LiveChart received symbol:', symbol);
        if (symbol) {
            fetchChartData();
            const interval = setInterval(fetchChartData, 30000);
            return () => clearInterval(interval);
        }
    }, [symbol]);

    const fetchChartData = async () => {
        if (!symbol) return;

        setLoading(true);
        setError(null);

        try {
            console.log('LiveChart fetching data for symbol:', symbol);

            // Fetch both OHLCV data and current price
            const [ohlcvResponse, priceResponse] = await Promise.all([
                fetch(`/api/ohlcv?symbol=${encodeURIComponent(symbol)}&timeframe=1h&limit=24`),
                fetch(`/api/current-price?symbol=${encodeURIComponent(symbol)}`)
            ]);

            if (!ohlcvResponse.ok) {
                console.warn(`OHLCV fetch failed for ${symbol}, using demo data`);
                generateDemoData();
                return;
            }

            const ohlcvData = await ohlcvResponse.json();

            if (priceResponse.ok) {
                const priceData = await priceResponse.json();
                setCurrentPrice(priceData.price);
                console.log('LiveChart fetched current price for', symbol, ':', priceData.price);
            }

            if (ohlcvData.data && ohlcvData.data.length > 0) {
                const chartPoints = ohlcvData.data.map((candle, index) => ({
                    time: new Date(candle.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    price: parseFloat(candle.close),
                    volume: parseFloat(candle.volume),
                    timestamp: candle.timestamp,
                    index: index
                }));

                setChartData(chartPoints);
                console.log('LiveChart updated with', chartPoints.length, 'data points for', symbol);
            } else {
                console.warn('No chart data received, using demo data');
                generateDemoData();
            }
        } catch (err) {
            console.error('Error fetching chart data for', symbol, ':', err);
            setError(err.message);
            generateDemoData();
        } finally {
            setLoading(false);
        }
    };

    const generateDemoData = () => {
        const symbolBase = symbol.split('/')[0] || 'DEMO';
        let basePrice = 100;

        // Set realistic base prices for different cryptocurrencies
        const priceMap = {
            'BTC': 58000,
            'ETH': 3500,
            'ADA': 0.5,
            'SOL': 150,
            'DOT': 25,
            'MATIC': 1.2,
            'AVAX': 35,
            'LINK': 15,
            'UNI': 8,
            'ATOM': 12,
            'LTC': 95,
            'XRP': 0.6,
            'DOGE': 0.08,
            'BNB': 320,
            'TRX': 0.12
        };

        basePrice = priceMap[symbolBase] || 100;

        const demoData = Array.from({ length: 24 }, (_, i) => {
            const volatility = basePrice * 0.002;
            const trend = Math.sin(i * 0.1) * (basePrice * 0.01);
            const price = basePrice + trend + (Math.random() - 0.5) * volatility;

            return {
                time: new Date(Date.now() - (24 - i) * 3600000).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                price: parseFloat(price.toFixed(2)),
                volume: Math.random() * 1000000,
                timestamp: Date.now() - (24 - i) * 3600000,
                index: i
            };
        });

        setChartData(demoData);
        setCurrentPrice(demoData[demoData.length - 1].price);
        setError('Using simulated data - API data unavailable');
        console.log('LiveChart generated demo data for', symbol, 'with base price:', basePrice);
    };

    // Get trade markers for visualization
    const getTradeMarkers = () => {
        if (!trades || trades.length === 0 || !chartData || chartData.length === 0) {
            return [];
        }

        return trades
            .filter(trade => trade.symbol === symbol)
            .map(trade => {
                const tradeTime = new Date(trade.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });
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
            })
            .filter(Boolean);
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '4px',
                    padding: '10px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {label}
                    </p>
                    <p style={{ margin: '2px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                        Price: ${data.price?.toFixed(2)}
                    </p>
                    <p style={{ margin: '2px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                        Volume: {(data.volume / 1000).toFixed(0)}K
                    </p>
                </div>
            );
        }
        return null;
    };

    const tradeMarkers = getTradeMarkers();
    const symbolBase = symbol.split('/')[0] || 'Unknown';

    if (loading && chartData.length === 0) {
        return (
            <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                padding: '20px',
                margin: '20px 0'
            }}>
                <h3 style={{ color: 'var(--text-primary)', margin: '0 0 20px 0', fontSize: '18px' }}>
                    Live Price Chart - {symbol}
                </h3>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '300px',
                    color: 'var(--text-muted)'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid var(--border-primary)',
                        borderLeft: '4px solid var(--accent-primary)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        marginBottom: '15px'
                    }}></div>
                    <p>Loading {symbolBase} price data...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '8px',
            padding: '20px',
            margin: '20px 0'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '10px'
            }}>
                <h3 style={{ color: 'var(--text-primary)', margin: '0', fontSize: '18px' }}>
                    Live Price Chart - {symbol}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {currentPrice && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Current:</span>
                            <span style={{
                                fontSize: '18px',
                                fontWeight: 'bold',
                                color: 'var(--accent-primary)'
                            }}>
                                ${currentPrice.toFixed(2)}
                            </span>
                        </div>
                    )}
                    {error && (
                        <div style={{
                            background: '#fff3cd',
                            color: '#856404',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            fontSize: '12px'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ marginBottom: '15px', minHeight: '300px' }}>
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                            <XAxis
                                dataKey="time"
                                stroke="var(--text-muted)"
                                tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                stroke="var(--text-muted)"
                                tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                                tickFormatter={(value) => `$${value.toFixed(0)}`}
                                domain={['dataMin - 20', 'dataMax + 20']}
                            />
                            <Tooltip content={<CustomTooltip />} />

                            <Line
                                type="monotone"
                                dataKey="price"
                                stroke="var(--accent-primary)"
                                strokeWidth={2}
                                dot={false}
                                name={`${symbolBase} Price`}
                                connectNulls={false}
                            />

                            {tradeMarkers.map((marker, index) => (
                                <ReferenceDot
                                    key={`trade-${index}`}
                                    x={marker.x}
                                    y={marker.y}
                                    r={5}
                                    fill={marker.trade.side === 'buy' ? '#28a745' : '#dc3545'}
                                    stroke="#ffffff"
                                    strokeWidth={2}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '300px',
                        color: 'var(--text-muted)',
                        fontSize: '16px'
                    }}>
                        No chart data available for {symbol}
                    </div>
                )}
            </div>

            {tradeMarkers.length > 0 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '20px',
                    marginTop: '10px'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: 'var(--text-muted)'
                    }}>
                        <span style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: '#28a745',
                            border: '2px solid #ffffff'
                        }}></span>
                        <span>Buy Orders</span>
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: 'var(--text-muted)'
                    }}>
                        <span style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: '#dc3545',
                            border: '2px solid #ffffff'
                        }}></span>
                        <span>Sell Orders</span>
                    </div>
                </div>
            )}

            <style>
                {`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}
            </style>
        </div>
    );
}

export default LiveChart;
