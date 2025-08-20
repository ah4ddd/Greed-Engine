import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Settings({ settings, setSettings }) {
    const [saveMessage, setSaveMessage] = useState('');
    const [loading, setLoading] = useState(false);

    // Load saved configuration on component mount
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const response = await axios.get('/api/load-config');
                if (response.data) {
                    setSettings(prev => ({ ...prev, ...response.data }));
                }
            } catch (error) {
                console.warn('Could not load saved configuration', error.message);
            }
        };
        loadConfig();
    }, [setSettings]);

    const handleChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const saveConfiguration = async () => {
        setLoading(true);
        setSaveMessage('Saving configuration...');

        try {
            const configData = {
                strategy_type: settings.strategy_type || 'default_ma',
                risk: settings.risk !== undefined ? settings.risk : 1.0,
                stop_loss: settings.stop_loss !== undefined ? settings.stop_loss : 1.0,
                take_profit: settings.take_profit !== undefined ? settings.take_profit : 2.0
            };

            await axios.post('/api/save-config', configData);
            setSaveMessage('Configuration saved successfully! ✅');

            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            setSaveMessage('Error saving configuration: ' + error.message);
            setTimeout(() => setSaveMessage(''), 5000);
        }

        setLoading(false);
    };

    return (
        <div className="settings">
            <h3>Bot Configuration</h3>

            <div className="settings-form">
                <div className="form-group">
                    <label>API Key</label>
                    <input
                        type="password"
                        value={settings.api_key || ''}
                        onChange={(e) => handleChange('api_key', e.target.value)}
                        placeholder="Enter your exchange API key"
                    />
                </div>

                <div className="form-group">
                    <label>API Secret</label>
                    <input
                        type="password"
                        value={settings.api_secret || ''}
                        onChange={(e) => handleChange('api_secret', e.target.value)}
                        placeholder="Enter your exchange API secret"
                    />
                </div>

                <div className="form-group">
                    <label>Exchange</label>
                    <select
                        value={settings.exchange || 'binance'}
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
                        value={settings.symbol || ''}
                        onChange={(e) => handleChange('symbol', e.target.value)}
                        placeholder="e.g., BTC/USDT, EUR/USD"
                    />
                </div>

                <div className="form-group checkbox-group">
                    <label>
                        <input
                            type="checkbox"
                            checked={settings.real_mode || false}
                            onChange={(e) => handleChange('real_mode', e.target.checked)}
                        />
                        Real Trading Mode (⚠️ Use real money)
                    </label>
                </div>

                <div className="form-group">
                    <label>Trading Strategy</label>
                    <select
                        value={settings.strategy_type || 'default_ma'}
                        onChange={(e) => handleChange('strategy_type', e.target.value)}
                    >
                        <option value="default_ma">Default MA Crossover (9/21)</option>
                        <option value="custom">Custom Strategy</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Risk per Trade (%)</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="5"
                        value={settings.risk !== undefined ? settings.risk : 1.0}
                        onChange={(e) => handleChange('risk', parseFloat(e.target.value))}
                        disabled={settings.strategy_type === 'default_ma'}
                    />
                    {settings.strategy_type === 'default_ma' && (
                        <small className="form-hint">Default: 1.0% (change to Custom Strategy to modify)</small>
                    )}
                </div>

                <div className="form-group">
                    <label>Stop Loss (%)</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="10"
                        value={settings.stop_loss !== undefined ? settings.stop_loss : 1.0}
                        onChange={(e) => handleChange('stop_loss', parseFloat(e.target.value))}
                        disabled={settings.strategy_type === 'default_ma'}
                    />
                    {settings.strategy_type === 'default_ma' && (
                        <small className="form-hint">Default: 1.0% (change to Custom Strategy to modify)</small>
                    )}
                </div>

                <div className="form-group">
                    <label>Take Profit (%)</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="20"
                        value={settings.take_profit !== undefined ? settings.take_profit : 2.0}
                        onChange={(e) => handleChange('take_profit', parseFloat(e.target.value))}
                        disabled={settings.strategy_type === 'default_ma'}
                    />
                    {settings.strategy_type === 'default_ma' && (
                        <small className="form-hint">Default: 2.0% (change to Custom Strategy to modify)</small>
                    )}
                </div>

                <div className="form-group">
                    <button
                        className="btn btn-primary save-config-btn"
                        onClick={saveConfiguration}
                        disabled={loading}
                    >
                        {loading ? (
                            <><span className="btn-spinner"></span>Saving...</>
                        ) : (
                            <>Save Configuration</>
                        )}
                    </button>

                    {saveMessage && (
                        <div className={`config-message ${saveMessage.includes('Error') ? 'error' : 'success'}`}>
                            {saveMessage}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Settings;
