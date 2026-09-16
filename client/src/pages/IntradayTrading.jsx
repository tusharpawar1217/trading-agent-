/**
 * Intraday Trading Page
 * 
 * Multi-timeframe view with H1, M15, M5 charts
 * Shows candlestick patterns and signal generation
 */

import { useState, useEffect } from 'react';
import { Activity, TrendingUp, Clock } from 'lucide-react';
import CandlestickChart from '../components/charts/CandlestickChart';
import TimeframeSelector from '../components/charts/TimeframeSelector';

function IntradayTrading() {
  const [pair, setPair] = useState('EUR/USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [signal, setSignal] = useState(null);
  const [timeframeData, setTimeframeData] = useState(null);
  const [selectedView, setSelectedView] = useState('M5'); // H1, M15, or M5
  
  const pairs = ['EUR/USD', 'EUR/GBP', 'EUR/JPY', 'EUR/CHF'];
  
  // Fetch timeframe data
  const fetchTimeframeData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:3001/api/intraday-signals/timeframes/${pair}?days=7`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setTimeframeData(data);
    } catch (err) {
      setError('Failed to load chart data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Generate signal
  const generateSignal = async () => {
    setLoading(true);
    setError(null);
    setSignal(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/intraday-signals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair, days: 7 }),
      });
      
      const data = await response.json();
      
      if (response.status === 403) {
        // Blocked by risk management
        setError(data.warning + ': ' + data.riskStatus.reason);
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate signal');
      }
      
      setSignal(data.signal);
      
      if (!data.signal) {
        setError(data.message || 'No signal - timeframes not aligned');
      }
      
    } catch (err) {
      setError('Failed to generate signal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Load data on mount and pair change
  useEffect(() => {
    fetchTimeframeData();
  }, [pair]);
  
  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '2px solid #e0e0e0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={32} color="#2196F3" />
          <div>
            <h1 style={{ margin: 0, fontSize: '28px' }}>Intraday Trading</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              Multi-timeframe analysis: H1 → M15 → M5
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              fontSize: '16px',
            }}
          >
            {pairs.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          
          <button
            onClick={generateSignal}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            {loading ? 'Analyzing...' : '🎯 Generate Signal'}
          </button>
        </div>
      </div>
      
      {/* Error */}
      {error && (
        <div style={{
          background: '#ffebee',
          border: '1px solid #f44336',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px',
          color: '#c62828',
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* Signal Card */}
      {signal && (
        <div style={{
          background: signal.direction === 'BUY' ? '#e8f5e9' : '#ffebee',
          border: `2px solid ${signal.direction === 'BUY' ? '#4CAF50' : '#f44336'}`,
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>
                {signal.direction === 'BUY' ? '📈' : '📉'} {signal.direction} {pair}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '15px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Entry</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{signal.entryPrice.toFixed(5)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Stop Loss</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f44336' }}>
                    {signal.stopLoss.toFixed(5)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Take Profit</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4CAF50' }}>
                    {signal.takeProfit.toFixed(5)}
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', color: '#666' }}>Strength</div>
              <div style={{ fontSize: '36px', fontWeight: 'bold' }}>{signal.strength}/100</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                {signal.alignment ? '✅ Aligned' : '❌ Not Aligned'}
              </div>
            </div>
          </div>
          
          <div style={{
            marginTop: '15px',
            padding: '15px',
            background: 'rgba(255,255,255,0.5)',
            borderRadius: '6px',
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Multi-Timeframe Status:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '14px' }}>
              <div>
                <Clock size={14} style={{ display: 'inline', marginRight: '5px' }} />
                H1: <strong>{signal.h1Trend}</strong>
              </div>
              <div>
                <Clock size={14} style={{ display: 'inline', marginRight: '5px' }} />
                M15: <strong>{signal.m15Trend}</strong>
              </div>
              <div>
                <Clock size={14} style={{ display: 'inline', marginRight: '5px' }} />
                M5: <strong>{signal.m5Trend}</strong>
              </div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '13px', color: '#555' }}>
              <strong>Reason:</strong> {signal.reason}
            </div>
          </div>
        </div>
      )}
      
      {/* Timeframe Tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '15px',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '10px',
      }}>
        {['H1', 'M15', 'M5'].map(tf => (
          <button
            key={tf}
            onClick={() => setSelectedView(tf)}
            style={{
              padding: '10px 20px',
              background: selectedView === tf ? '#2196F3' : 'white',
              color: selectedView === tf ? 'white' : 'black',
              border: selectedView === tf ? 'none' : '1px solid #ccc',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: selectedView === tf ? 'bold' : 'normal',
              fontSize: '14px',
            }}
          >
            {tf === 'H1' && '📊 1-Hour (Bias)'}
            {tf === 'M15' && '📈 15-Min (Confirmation)'}
            {tf === 'M5' && '⚡ 5-Min (Entry)'}
          </button>
        ))}
      </div>
      
      {/* Chart */}
      {loading && !timeframeData && (
        <div style={{
          padding: '60px',
          textAlign: 'center',
          background: '#f5f5f5',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '18px', color: '#666' }}>Loading chart data...</div>
        </div>
      )}
      
      {timeframeData && (
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ margin: '0 0 15px 0' }}>
            {timeframeData.timeframes[selectedView].description}
          </h3>
          
          <CandlestickChart
            candles={timeframeData.timeframes[selectedView].candles}
            signals={signal ? [{
              timestamp: signal.timestamp,
              entryPrice: signal.entryPrice,
              direction: signal.direction,
              stopLoss: signal.stopLoss,
              takeProfit: signal.takeProfit,
            }] : []}
            width="100%"
            height={500}
            title={`${pair} - ${selectedView} Chart`}
          />
          
          <div style={{
            marginTop: '15px',
            padding: '15px',
            background: '#f9f9f9',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#666',
          }}>
            <strong>Chart Info:</strong> Showing last {timeframeData.timeframes[selectedView].candles.length} candles on {selectedView} timeframe.
            {signal && ' Signal markers show entry (triangle), stop loss (red line), and take profit (green line).'}
          </div>
        </div>
      )}
      
      {/* Help Text */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        background: '#e3f2fd',
        borderRadius: '8px',
        border: '1px solid #2196F3',
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#1976D2' }}>
          📚 How Intraday Signals Work
        </h3>
        <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
          <li><strong>H1 (1-hour):</strong> Determines the overall trend direction for the day</li>
          <li><strong>M15 (15-minute):</strong> Confirms the H1 trend with structure analysis</li>
          <li><strong>M5 (5-minute):</strong> Provides precise entry timing when aligned with H1 and M15</li>
          <li><strong>Signal fires ONLY when all 3 timeframes agree</strong> on direction (BULLISH or BEARISH)</li>
          <li><strong>Stop loss:</strong> ATR-based (1.5× average volatility) on M5 chart</li>
          <li><strong>Take profit:</strong> 2:1 risk-reward ratio (if risk 50 pips, reward 100 pips)</li>
        </ul>
      </div>
    </div>
  );
}

export default IntradayTrading;
