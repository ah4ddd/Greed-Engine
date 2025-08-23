import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Settings({ settings, setSettings }) {
    const [saveMessage, setSaveMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [symbolInput, setSymbolInput] = useState(''); // Local state for symbol input

    // Initialize local symbol input from settings
    useEffect(() => {
        setSymbolInput(settings.symbol || '');
    }, [settings.symbol]);

    // Load saved configuration on component mount
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const response = await axios.get('/api/load-config');
                if (response.data) {
                    setSettings(prev => ({
                        ...prev,
                        ...response.data
                    }));
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

    // Special handler for symbol that updates both local state and settings
    const handleSymbolChange = (value) => {
        setSymbolInput(value); // Update local state immediately
        handleChange('symbol', value); // Update settings
    };

    const testConnection = async () => {
        if (!settings.api_key || !settings.api_secret) {
            alert('Please enter API key and secret first');
            return;
        }

        try {
            const response = await axios.post('/api/test-connection', {
                api_key: settings.api_key,
                api_secret: settings.api_secret,
                exchange: settings.exchange || 'binance'
            });

            if (response.data.success) {
                alert(`✅ Connection Success!\nYour USDT Balance: ${response.data.your_usdt_balance}\nBTC Price: ${response.data.current_btc_price}`);
            }
        } catch (error) {
            alert(`❌ Connection Failed: ${error.response?.data?.error || error.message}`);
        }
    };

    const saveConfiguration = async () => {
        setLoading(true);
        setSaveMessage('Saving configuration...');

        try {
            const configData = {
                strategy_type: settings.strategy_type || 'default_ma',
                risk: settings.risk !== undefined ? settings.risk : 1.0,
                stop_loss: settings.stop_loss !== undefined ? settings.stop_loss : 1.0,
                take_profit: settings.take_profit !== undefined ? settings.take_profit : 2.0,
                symbol: symbolInput || settings.symbol, // Use local symbol input
                trading_mode: settings.trading_mode || 'spot',
                leverage: settings.leverage !== undefined ? settings.leverage : 1,
                kill_switch_threshold: settings.kill_switch_threshold !== undefined ? settings.kill_switch_threshold : 10
            };

            await axios.post('/api/save-config', configData);
            setSaveMessage('Configuration saved successfully!');
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

                {/* Existing API Configuration */}
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
                    <button
                        onClick={testConnection}
                        style={{
                            marginTop: '10px',
                            padding: '8px 16px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        🧪 Test API Connection
                    </button>
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
                        value={symbolInput}
                        onChange={(e) => handleSymbolChange(e.target.value)}
                        placeholder="e.g., BTC/USDT, ETH/USDT, ADA/USDT"
                        style={{
                            textTransform: 'uppercase'
                        }}
                    />
                    <small style={{ color: '#888', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                        Popular pairs: ETH/USDT, ADA/USDT, SOL/USDT, MATIC/USDT, DOT/USDT
                    </small>
                </div>

                {/* NEW: Trading Mode Selection */}
                <div className="form-group">
                    <label>Trading Mode</label>
                    <select
                        value={settings.trading_mode || 'spot'}
                        onChange={(e) => handleChange('trading_mode', e.target.value)}
                    >
                        <option value="spot">Spot Trading</option>
                        <option value="futures">Futures Trading</option>
                    </select>
                </div>

                {/* NEW: Leverage setting (only show for futures) */}
                {settings.trading_mode === 'futures' && (
                    <div className="form-group">
                        <label>Leverage (1x - 10x)</label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={settings.leverage || 3}
                            onChange={(e) => handleChange('leverage', parseInt(e.target.value))}
                        />
                        <small style={{ color: '#888', fontSize: '12px' }}>
                            ⚠️ Higher leverage = Higher risk of liquidation
                        </small>
                    </div>
                )}

                {/* NEW: Futures trading warning */}
                {settings.trading_mode === 'futures' && (
                    <div style={{
                        background: '#130f02ff',
                        padding: '12px',
                        borderRadius: '6px',
                        margin: '10px 0',
                        border: '1px solid #a70000ff'
                    }}>
                        <strong>⚠️ Futures Trading Warning:</strong>
                        <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '13px' }}>
                            <li>Leverage amplifies both profits AND losses</li>
                            <li>Funding fees are charged every 8 hours</li>
                            <li>Risk of liquidation if trades go against you</li>
                            <li>Start with low leverage (2-3x) and small amounts</li>
                        </ul>
                    </div>
                )}

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

                {/* Existing Strategy Configuration */}
                <div className="form-group">
                    <label>Strategy Type</label>
                    <select
                        value={settings.strategy_type || 'default_ma'}
                        onChange={(e) => handleChange('strategy_type', e.target.value)}
                    >
                        <option value="default_ma">Default MA Crossover</option>
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
                    />
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
                    />
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
                    />
                </div>

                {/* NEW: Kill Switch Configuration */}
                <div className="form-group">
                    <label>Kill Switch (Consecutive Losses)</label>
                    <input
                        type="number"
                        min="5"
                        max="20"
                        value={settings.kill_switch_threshold !== undefined ? settings.kill_switch_threshold : 10}
                        onChange={(e) => handleChange('kill_switch_threshold', parseInt(e.target.value))}
                    />
                    <small style={{ color: '#888', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                        Bot will auto-stop after this many consecutive losses (5-20)
                    </small>
                </div>

                {/* NEW: Kill Switch Info Box */}
                <div style={{
                    background: '#000000ff',
                    padding: '12px',
                    borderRadius: '6px',
                    margin: '10px 0',
                    border: '1px solid #16213e'
                }}>
                    <strong>🛡️ Kill Switch Protection:</strong>
                    <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '13px' }}>
                        <li>Automatically stops bot after consecutive losses</li>
                        <li>Protects against black swan events</li>
                        <li>Based on data : longest streak was 6 losses</li>
                        <li>Manual reset required to resume trading</li>
                    </ul>
                </div>

                {settings.strategy_type === 'custom' && (
                    <div className="form-group">
                        <label>Trade Amount (USD) - Optional</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={settings.trade_amount || ''}
                            onChange={(e) => handleChange('trade_amount', parseFloat(e.target.value) || null)}
                            placeholder="Leave blank for balance-based sizing"
                        />
                    </div>
                )}

                {/* Save Configuration Button */}
                <div className="form-group">
                    <button
                        onClick={saveConfiguration}
                        disabled={loading}
                        className={saveMessage.includes('successfully') ? 'btn-success' : 'btn-primary'}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            backgroundColor: saveMessage.includes('successfully') ? '#28a745' : '#000000ff',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        {loading ? 'Saving...' : 'Save Configuration'}
                    </button>

                    {saveMessage && (
                        <div style={{
                            marginTop: '10px',
                            padding: '8px',
                            borderRadius: '4px',
                            fontSize: '13px',
                            backgroundColor: saveMessage.includes('successfully') ? '#d4edda' : '#f8d7da',
                            color: saveMessage.includes('successfully') ? '#155724' : '#721c24',
                            border: `1px solid ${saveMessage.includes('successfully') ? '#c3e6cb' : '#f5c6cb'}`
                        }}>
                            {saveMessage}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Settings;
