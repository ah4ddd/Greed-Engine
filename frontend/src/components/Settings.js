import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function Settings({ onSettingsChange }) {
    const [config, setConfig] = useState({
        strategy_type: 'default_ma',
        risk: 1.0,
        stop_loss: 1.0,
        take_profit: 3.0,
        symbol: 'BTC/USDT',
        symbols: ['BTC/USDT'],
        trading_mode: 'spot',
        leverage: 1,
        kill_switch_threshold: 5,
        trade_amount: 1000,
        multi_pair_mode: false,
        aggressive_mode: false,
        super_aggressive_mode: false,
        api_key: '',
        api_secret: '',
        exchange: 'binance',
        real_mode: false
    });

    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('');
    const [testingConnection, setTestingConnection] = useState(false);
    const [configLoaded, setConfigLoaded] = useState(false);

    const popularPairs = [
        'BTC/USDT', 'ETH/USDT', 'ADA/USDT', 'SOL/USDT', 'MATIC/USDT',
        'DOT/USDT', 'AVAX/USDT', 'LINK/USDT', 'UNI/USDT', 'ATOM/USDT',
        'LTC/USDT', 'XRP/USDT', 'DOGE/USDT', 'BNB/USDT', 'TRX/USDT'
    ];

    const loadConfiguration = useCallback(async () => {
        if (loading || saving) return; // Prevent loading during save operations

        try {
            setLoading(true);
            setMessage('');
            console.log('Loading configuration...');

            const response = await axios.get('/api/load-config');
            const loadedConfig = response.data;

            console.log('Raw loaded config:', loadedConfig);

            // Ensure symbols is always an array
            if (!loadedConfig.symbols || !Array.isArray(loadedConfig.symbols)) {
                if (loadedConfig.symbol) {
                    loadedConfig.symbols = [loadedConfig.symbol];
                } else {
                    loadedConfig.symbols = ['BTC/USDT'];
                    loadedConfig.symbol = 'BTC/USDT';
                }
            }

            // Ensure symbol is set from symbols array if missing
            if (!loadedConfig.symbol && loadedConfig.symbols.length > 0) {
                loadedConfig.symbol = loadedConfig.symbols[0];
            }

            console.log('Processed config:', loadedConfig);
            setConfig(loadedConfig);
            setConfigLoaded(true);

            // Only notify parent component if this is the initial load or a manual reload
            if (onSettingsChange && !configLoaded) {
                onSettingsChange(loadedConfig);
            }

            setMessage('Configuration loaded successfully');

            // Clear success message after 3 seconds
            setTimeout(() => setMessage(''), 3000);

        } catch (error) {
            console.error('Error loading configuration:', error);
            setMessage('Error loading configuration: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    }, [loading, saving, onSettingsChange, configLoaded]);

    // Load config only once when component mounts
    useEffect(() => {
        if (!configLoaded) {
            loadConfiguration();
        }
    }, [configLoaded, loadConfiguration]);

    const saveConfiguration = async () => {
        if (saving || loading) return; // Prevent multiple saves

        setSaving(true);
        setMessage('');

        try {
            console.log('Saving configuration:', config);

            // Validate configuration before saving
            const configToSave = { ...config };

            // Ensure symbols array is properly formatted
            if (!configToSave.multi_pair_mode) {
                configToSave.symbols = [configToSave.symbol];
            }

            console.log('Config to save:', configToSave);

            const response = await axios.post('/api/save-config', configToSave);
            console.log('Save response:', response.data);

            setMessage('Configuration saved successfully!');

            // Notify parent component of changes
            if (onSettingsChange) {
                onSettingsChange(configToSave);
            }

            // Clear success message after 3 seconds
            setTimeout(() => setMessage(''), 3000);

        } catch (error) {
            console.error('Error saving configuration:', error);
            setMessage('Error saving configuration: ' + (error.response?.data?.error || error.message));
        } finally {
            setSaving(false);
        }
    };

    const testConnection = async () => {
        if (!config.api_key || !config.api_secret) {
            setConnectionStatus('Please enter API Key and Secret first');
            return;
        }

        setTestingConnection(true);
        setConnectionStatus('Testing connection...');

        try {
            const response = await axios.post('/api/test-connection', {
                api_key: config.api_key,
                api_secret: config.api_secret,
                exchange: config.exchange
            });

            if (response.data.success) {
                setConnectionStatus(`✅ ${response.data.message} | Balance: $${response.data.your_usdt_balance}`);
            }
        } catch (error) {
            setConnectionStatus(`❌ ${error.response?.data?.error || error.message}`);
        } finally {
            setTestingConnection(false);
        }
    };

    const handleInputChange = (field, value) => {
        console.log(`Changing ${field} to:`, value);

        const updatedConfig = { ...config };
        updatedConfig[field] = value;

        // Handle mode changes
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
            // Keep current symbol, ensure it's in symbols array
            if (!updatedConfig.symbols.includes(updatedConfig.symbol)) {
                updatedConfig.symbols = [updatedConfig.symbol];
            }
        }

        // Handle symbol changes
        if (field === 'symbol') {
            console.log('Symbol field changed to:', value);
            if (!updatedConfig.multi_pair_mode) {
                // Single pair mode - update symbols array to match
                updatedConfig.symbols = [value];
            } else if (!updatedConfig.symbols.includes(value)) {
                // Multi pair mode - add to front if not present
                updatedConfig.symbols = [value, ...updatedConfig.symbols];
            }
        }

        // Handle symbols array changes
        if (field === 'symbols' && Array.isArray(value) && value.length > 0) {
            updatedConfig.symbol = value[0]; // Set first symbol as primary
        }

        console.log('Updated config:', updatedConfig);
        setConfig(updatedConfig);
    };

    const addTradingPair = (pair) => {
        if (!config.symbols.includes(pair) && config.symbols.length < (config.super_aggressive_mode ? 15 : 8)) {
            const newSymbols = [...config.symbols, pair];
            handleInputChange('symbols', newSymbols);
        }
    };

    const removeTradingPair = (pair) => {
        if (config.symbols.length > 1) {
            const newSymbols = config.symbols.filter(s => s !== pair);
            // If removing the primary symbol, set the first remaining as primary
            if (pair === config.symbol && newSymbols.length > 0) {
                const updatedConfig = { ...config };
                updatedConfig.symbols = newSymbols;
                updatedConfig.symbol = newSymbols[0];
                setConfig(updatedConfig);
            } else {
                handleInputChange('symbols', newSymbols);
            }
        }
    };

    return (
        <div className="settings">
            <h2>Trading Configuration</h2>

            {message && (
                <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            {/* Trading Mode Selection */}
            <div className="settings-section">
                <h3>Trading Speed Mode</h3>
                <div className="mode-selection">
                    <label className="mode-option">
                        <input
                            type="radio"
                            name="tradingSpeed"
                            checked={!config.aggressive_mode && !config.super_aggressive_mode}
                            onChange={() => {
                                handleInputChange('aggressive_mode', false);
                                handleInputChange('super_aggressive_mode', false);
                            }}
                        />
                        <div>
                            <span className="mode-title">Conservative (Original)</span>
                            <div className="mode-description">
                                1-hour candles • 5-min cooldown • 3-8 trades/day • Safe & steady
                            </div>
                        </div>
                    </label>

                    <label className="mode-option aggressive">
                        <input
                            type="radio"
                            name="tradingSpeed"
                            checked={config.aggressive_mode}
                            onChange={() => handleInputChange('aggressive_mode', true)}
                        />
                        <div>
                            <span className="mode-title">⚡ Aggressive (Fast)</span>
                            <div className="mode-description">
                                5-min candles • 30-sec cooldown • 10-25 trades/day • Higher frequency
                            </div>
                        </div>
                    </label>

                    <label className="mode-option super-aggressive">
                        <input
                            type="radio"
                            name="tradingSpeed"
                            checked={config.super_aggressive_mode}
                            onChange={() => handleInputChange('super_aggressive_mode', true)}
                        />
                        <div>
                            <span className="mode-title">🚀 Super Aggressive (Maximum)</span>
                            <div className="mode-description">
                                5-min candles • 15-sec checks • 30-60 trades/day • Multiple pairs required
                            </div>
                        </div>
                    </label>
                </div>
            </div>

            {/* Multi-Pair Trading */}
            <div className="settings-section">
                <h3>Multi-Pair Trading</h3>
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={config.multi_pair_mode}
                        onChange={(e) => handleInputChange('multi_pair_mode', e.target.checked)}
                        disabled={config.super_aggressive_mode}
                    />
                    Enable Multi-Pair Trading {config.super_aggressive_mode && '(Required for Super Aggressive)'}
                </label>

                {config.multi_pair_mode && (
                    <div className="multi-pair-config">
                        <div className="selected-pairs">
                            <h4>Selected Trading Pairs ({config.symbols.length}/{config.super_aggressive_mode ? 15 : 8})</h4>
                            <div className="pairs-list">
                                {config.symbols.map((pair, index) => (
                                    <div key={pair} className={`pair-tag ${index === 0 ? 'primary' : ''}`}>
                                        <span>{pair}</span>
                                        {index === 0 && <small>(Primary)</small>}
                                        {config.symbols.length > 1 && (
                                            <button
                                                onClick={() => removeTradingPair(pair)}
                                                className="remove-btn"
                                                title="Remove pair"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="add-pairs">
                            <h4>Add Popular Pairs:</h4>
                            <div className="popular-pairs">
                                {popularPairs
                                    .filter(pair => !config.symbols.includes(pair))
                                    .map(pair => (
                                        <button
                                            key={pair}
                                            onClick={() => addTradingPair(pair)}
                                            disabled={config.symbols.length >= (config.super_aggressive_mode ? 15 : 8)}
                                            className="add-pair-btn"
                                        >
                                            + {pair}
                                        </button>
                                    ))
                                }
                            </div>
                        </div>

                        {config.super_aggressive_mode && config.symbols.length < 3 && (
                            <div className="warning">
                                ⚠️ Super Aggressive mode requires at least 3 trading pairs!
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Basic Trading Settings */}
            <div className="settings-section">
                <h3>Basic Trading Settings</h3>

                {!config.multi_pair_mode && (
                    <div className="form-group">
                        <label>Primary Trading Pair</label>
                        <select
                            value={config.symbol}
                            onChange={(e) => {
                                console.log('Select changed to:', e.target.value);
                                handleInputChange('symbol', e.target.value);
                            }}
                        >
                            {popularPairs.map(pair => (
                                <option key={pair} value={pair}>{pair}</option>
                            ))}
                        </select>
                        <small>Current: {config.symbol}</small>
                    </div>
                )}

                <div className="form-row">
                    <div className="form-group">
                        <label>Strategy Type</label>
                        <select
                            value={config.strategy_type}
                            onChange={(e) => handleInputChange('strategy_type', e.target.value)}
                        >
                            <option value="default_ma">Default MA Crossover</option>
                            <option value="custom">Custom Strategy</option>
                            <option value="momentum">Momentum Breakout</option>
                            {(config.aggressive_mode || config.super_aggressive_mode) && (
                                <option value="aggressive_ema">Aggressive EMA</option>
                            )}
                        </select>
                        {(config.aggressive_mode || config.super_aggressive_mode) && (
                            <small>Aggressive modes use optimized strategies</small>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Trade Amount ($)</label>
                        <input
                            type="number"
                            step="100"
                            min="100"
                            max="50000"
                            value={config.trade_amount}
                            onChange={(e) => handleInputChange('trade_amount', parseFloat(e.target.value))}
                        />
                        <small>
                            Recommended: ${config.super_aggressive_mode ? '300-1000' : config.aggressive_mode ? '500-2000' : '1000-5000'}
                        </small>
                    </div>
                </div>
            </div>

            {/* Risk Management */}
            <div className="settings-section">
                <h3>Risk Management</h3>
                <div className="form-row">
                    <div className="form-group">
                        <label>Risk per Trade (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="5"
                            value={config.risk}
                            onChange={(e) => handleInputChange('risk', parseFloat(e.target.value))}
                        />
                        {config.multi_pair_mode && (
                            <small>Will be split across {config.symbols.length} pairs</small>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Stop Loss (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="10"
                            value={config.stop_loss}
                            onChange={(e) => handleInputChange('stop_loss', parseFloat(e.target.value))}
                        />
                        <small>
                            Recommended: {(config.aggressive_mode || config.super_aggressive_mode) ? '1.5-2.5%' : '2-4%'}
                        </small>
                    </div>

                    <div className="form-group">
                        <label>Take Profit (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            min="1"
                            max="20"
                            value={config.take_profit}
                            onChange={(e) => handleInputChange('take_profit', parseFloat(e.target.value))}
                        />
                        <small>
                            Recommended: {(config.aggressive_mode || config.super_aggressive_mode) ? '2-4%' : '4-8%'}
                        </small>
                    </div>
                </div>

                <div className="form-group">
                    <label>Kill Switch Threshold</label>
                    <input
                        type="number"
                        min="1"
                        max="50"
                        value={config.kill_switch_threshold}
                        onChange={(e) => handleInputChange('kill_switch_threshold', parseInt(e.target.value))}
                    />
                    <small>
                        Stop trading after this many consecutive losses
                        {config.super_aggressive_mode ? ' (Recommended: 15-25)' :
                            config.aggressive_mode ? ' (Recommended: 10-15)' : ' (Recommended: 5-10)'}
                    </small>
                </div>
            </div>

            {/* Exchange Settings */}
            <div className="settings-section">
                <h3>Exchange Configuration</h3>

                <div className="form-group">
                    <label>Exchange</label>
                    <select
                        value={config.exchange}
                        onChange={(e) => handleInputChange('exchange', e.target.value)}
                    >
                        <option value="binance">Binance</option>
                        <option value="coinbase">Coinbase Pro</option>
                        <option value="kraken">Kraken</option>
                    </select>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>Trading Mode</label>
                        <select
                            value={config.trading_mode}
                            onChange={(e) => handleInputChange('trading_mode', e.target.value)}
                        >
                            <option value="spot">Spot Trading</option>
                            <option value="futures">Futures Trading</option>
                        </select>
                    </div>

                    {config.trading_mode === 'futures' && (
                        <div className="form-group">
                            <label>Leverage</label>
                            <select
                                value={config.leverage}
                                onChange={(e) => handleInputChange('leverage', parseInt(e.target.value))}
                            >
                                <option value="1">1x</option>
                                <option value="2">2x</option>
                                <option value="3">3x</option>
                                <option value="5">5x</option>
                                <option value="10">10x</option>
                            </select>
                            <small>⚠️ Higher leverage = higher risk</small>
                        </div>
                    )}
                </div>
            </div>

            {/* API Settings */}
            <div className="settings-section">
                <h3>API Configuration</h3>

                <div className="form-group">
                    <label>API Key</label>
                    <input
                        type="password"
                        value={config.api_key}
                        onChange={(e) => handleInputChange('api_key', e.target.value)}
                        placeholder="Enter your exchange API key"
                    />
                </div>

                <div className="form-group">
                    <label>API Secret</label>
                    <input
                        type="password"
                        value={config.api_secret}
                        onChange={(e) => handleInputChange('api_secret', e.target.value)}
                        placeholder="Enter your exchange API secret"
                    />
                </div>

                <div className="form-group">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={config.real_mode}
                            onChange={(e) => handleInputChange('real_mode', e.target.checked)}
                        />
                        Enable Live Trading (⚠️ Real money will be used!)
                    </label>
                    <small>
                        Unchecked = Paper trading (simulation only)
                    </small>
                </div>

                <button
                    onClick={testConnection}
                    disabled={testingConnection || !config.api_key || !config.api_secret}
                    className="btn btn-info test-connection-btn"
                >
                    {testingConnection ? 'Testing...' : 'Test API Connection'}
                </button>

                {connectionStatus && (
                    <div className={`connection-status ${connectionStatus.includes('✅') ? 'success' : 'error'}`}>
                        {connectionStatus}
                    </div>
                )}
            </div>

            {/* Current Configuration Summary */}
            <div className="settings-section">
                <h3>Configuration Summary</h3>
                {(loading || saving) ? (
                    <div className="config-loading">
                        <div className="spinner"></div>
                        <span>{saving ? 'Saving configuration...' : 'Loading configuration...'}</span>
                    </div>
                ) : (
                    <div className="config-summary">
                        <div className="summary-item">
                            <span>Mode:</span>
                            <span>
                                {config.super_aggressive_mode ? '🚀 Super Aggressive' :
                                    config.aggressive_mode ? '⚡ Aggressive' : 'Conservative'}
                            </span>
                        </div>
                        <div className="summary-item">
                            <span>Trading Pairs:</span>
                            <span>
                                {config.multi_pair_mode ?
                                    `${config.symbols.length} pairs (${config.symbols.slice(0, 3).join(', ')}${config.symbols.length > 3 ? '...' : ''})` :
                                    config.symbol
                                }
                            </span>
                        </div>
                        <div className="summary-item">
                            <span>Expected Frequency:</span>
                            <span>
                                {config.super_aggressive_mode ? '30-60 trades/day' :
                                    config.aggressive_mode ? '10-25 trades/day' : '3-8 trades/day'}
                            </span>
                        </div>
                        <div className="summary-item">
                            <span>Risk per Trade:</span>
                            <span>
                                {config.multi_pair_mode ?
                                    `${(config.risk / config.symbols.length).toFixed(2)}% per pair` :
                                    `${config.risk}%`
                                }
                            </span>
                        </div>
                        <div className="summary-item">
                            <span>Trade Amount:</span>
                            <span>${config.trade_amount}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="settings-actions">
                <button
                    onClick={saveConfiguration}
                    disabled={loading || saving}
                    className="btn btn-primary save-btn"
                >
                    {saving ? 'Saving...' : 'Save Configuration'}
                </button>

                <button
                    onClick={() => {
                        setConfigLoaded(false);
                        loadConfiguration();
                    }}
                    className="btn btn-secondary"
                    disabled={loading || saving}
                >
                    {loading ? 'Loading...' : 'Reload Configuration'}
                </button>
            </div>

            <style jsx>{`
                .settings {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }

                .message {
                    margin-bottom: 20px;
                    padding: 15px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: bold;
                }

                .message.success {
                    background: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                }

                .message.error {
                    background: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                }

                .settings-section {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-primary);
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                }

                .settings-section h3 {
                    margin-top: 0;
                    color: var(--text-primary);
                    border-bottom: 2px solid var(--accent-primary);
                    padding-bottom: 10px;
                }

                .mode-selection {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }

                .mode-option {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 15px;
                    border: 2px solid var(--border-primary);
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .mode-option:hover {
                    border-color: var(--accent-primary);
                }

                .mode-option.aggressive {
                    border-color: #ff8800;
                }

                .mode-option.super-aggressive {
                    border-color: #ff4444;
                }

                .mode-option input[type="radio"] {
                    margin-top: 2px;
                    min-width: 16px;
                }

                .mode-title {
                    font-weight: bold;
                    color: var(--text-primary);
                    display: block;
                    margin-bottom: 5px;
                }

                .mode-description {
                    font-size: 12px;
                    color: var(--text-muted);
                }

                .multi-pair-config {
                    margin-top: 15px;
                }

                .pairs-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 15px;
                }

                .pair-tag {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--accent-primary);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    position: relative;
                }

                .pair-tag.primary {
                    background: #28a745;
                }

                .pair-tag small {
                    font-size: 10px;
                    opacity: 0.8;
                }

                .remove-btn {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .remove-btn:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                .popular-pairs {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .add-pair-btn {
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-primary);
                    padding: 6px 12px;
                    border-radius: 15px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .add-pair-btn:hover:not(:disabled) {
                    background: var(--accent-primary);
                    color: white;
                }

                .add-pair-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }

                .form-group {
                    margin-bottom: 15px;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                    color: var(--text-primary);
                }

                .checkbox-label {
                    display: flex !important;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 5px;
                }

                .form-group input,
                .form-group select {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid var(--border-primary);
                    border-radius: 4px;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    font-size: 14px;
                }

                .form-group small {
                    display: block;
                    margin-top: 5px;
                    color: var(--text-muted);
                    font-size: 11px;
                }

                .config-loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                    padding: 40px;
                    color: var(--text-muted);
                }

                .spinner {
                    width: 30px;
                    height: 30px;
                    border: 3px solid var(--border-primary);
                    border-top: 3px solid var(--accent-primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .config-summary {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    background: var(--bg-tertiary);
                    padding: 15px;
                    border-radius: 6px;
                }

                .summary-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 13px;
                }

                .summary-item span:first-child {
                    color: var(--text-muted);
                    font-weight: normal;
                }

                .summary-item span:last-child {
                    color: var(--text-primary);
                    font-weight: bold;
                }

                .settings-actions {
                    display: flex;
                    gap: 15px;
                    margin-top: 20px;
                }

                .btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .btn-primary {
                    background: var(--accent-primary);
                    color: white;
                }

                .btn-primary:hover:not(:disabled) {
                    background: var(--accent-secondary);
                    transform: translateY(-2px);
                }

                .btn-secondary {
                    background: var(--bg-tertiary);
                    color: var(--text-primary);
                    border: 1px solid var(--border-primary);
                }

                .btn-secondary:hover:not(:disabled) {
                    background: var(--bg-secondary);
                }

                .btn-info {
                    background: #17a2b8;
                    color: white;
                }

                .btn-info:hover:not(:disabled) {
                    background: #138496;
                }

                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none !important;
                }

                .test-connection-btn {
                    margin-top: 10px;
                }

                .connection-status {
                    margin-top: 10px;
                    padding: 10px;
                    border-radius: 4px;
                    font-size: 13px;
                }

                .connection-status.success {
                    background: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                }

                .connection-status.error {
                    background: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                }

                .warning {
                    background: #fff3cd;
                    color: #856404;
                    border: 1px solid #ffeaa7;
                    padding: 10px;
                    border-radius: 4px;
                    margin-top: 10px;
                    font-size: 13px;
                }

                @media (max-width: 768px) {
                    .form-row {
                        grid-template-columns: 1fr;
                    }

                    .config-summary {
                        grid-template-columns: 1fr;
                    }

                    .settings-actions {
                        flex-direction: column;
                    }
                }
               `}</style>
        </div>
    );
}

export default Settings;

