import React from 'react';

function Settings({ settings, setSettings }) {
    const handleChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <div className="settings">
            <h3>Bot Configuration</h3>

            <div className="settings-form">
                <div className="form-group">
                    <label>API Key</label>
                    <input
                        type="password"
                        value={settings.api_key}
                        onChange={(e) => handleChange('api_key', e.target.value)}
                        placeholder="Enter your exchange API key"
                    />
                </div>

                <div className="form-group">
                    <label>API Secret</label>
                    <input
                        type="password"
                        value={settings.api_secret}
                        onChange={(e) => handleChange('api_secret', e.target.value)}
                        placeholder="Enter your exchange API secret"
                    />
                </div>

                <div className="form-group">
                    <label>Exchange</label>
                    <select
                        value={settings.exchange}
                        onChange={(e) => handleChange('exchange', e.target.value)}
                    >
                        <option value="binance">Binance</option>
                        <option value="kraken">Kraken</option>
                        <option value="bitfinex">Bitfinex</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Trading Pair</label>
                    <input
                        type="text"
                        value={settings.symbol}
                        onChange={(e) => handleChange('symbol', e.target.value)}
                        placeholder="e.g., BTC/USDT, EUR/USD"
                    />
                </div>

                <div className="form-group checkbox-group">
                    <label>
                        <input
                            type="checkbox"
                            checked={settings.real_mode}
                            onChange={(e) => handleChange('real_mode', e.target.checked)}
                        />
                        Real Trading Mode (⚠️ Use real money)
                    </label>
                </div>

                <div className="form-group">
                    <label>Risk per Trade (%)</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="5"
                        value={settings.risk}
                        onChange={(e) => handleChange('risk', parseFloat(e.target.value))}
                    />
                </div>

                <div className="form-group">
                    <label>Stop Loss (%)</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="10"
                        value={settings.stop_loss}
                        onChange={(e) => handleChange('stop_loss', parseFloat(e.target.value))}
                    />
                </div>

                <div className="form-group">
                    <label>Take Profit (%)</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="20"
                        value={settings.take_profit}
                        onChange={(e) => handleChange('take_profit', parseFloat(e.target.value))}
                    />
                </div>
            </div>
        </div>
    );
}

export default Settings;
