import { calculateAllIndicators } from '../utils/indicators';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function IndicatorPanel({ marketData }) {
  if (!marketData || !marketData.data || marketData.data.length === 0) {
    return null;
  }

  const indicators = calculateAllIndicators(marketData.data);
  const lastIndex = marketData.data.length - 1;
  
  // Get latest values
  const latestClose = marketData.data[lastIndex].close;
  const latestSMA20 = indicators.sma20[lastIndex];
  const latestSMA50 = indicators.sma50[lastIndex];
  const latestRSI = indicators.rsi[lastIndex];
  const latestMACD = indicators.macd.macd[lastIndex];
  const latestSignal = indicators.macd.signal[lastIndex];
  const latestHistogram = indicators.macd.histogram[lastIndex];
  const latestBBUpper = indicators.bollingerBands.upper[lastIndex];
  const latestBBMiddle = indicators.bollingerBands.middle[lastIndex];
  const latestBBLower = indicators.bollingerBands.lower[lastIndex];

  // Calculate position within Bollinger Bands
  const bbPosition = latestBBUpper && latestBBLower
    ? ((latestClose - latestBBLower) / (latestBBUpper - latestBBLower)) * 100
    : null;

  // Determine trend indicators
  const smaSignal = latestSMA20 && latestClose > latestSMA20 ? 'bullish' : 'bearish';
  const macdSignal = latestMACD && latestSignal && latestMACD > latestSignal ? 'bullish' : 'bearish';
  
  let rsiSignal = 'neutral';
  if (latestRSI !== null) {
    if (latestRSI > 70) rsiSignal = 'overbought';
    else if (latestRSI < 30) rsiSignal = 'oversold';
  }

  const IndicatorCard = ({ title, value, signal, description }) => (
    <div style={{
      background: 'var(--bg-tertiary)',
      borderRadius: '8px',
      padding: '1rem',
      border: '1px solid var(--border-color)',
    }}>
      <div className="flex-between mb-1">
        <span className="text-muted" style={{ fontSize: '0.875rem' }}>{title}</span>
        {signal && (
          <span className={`badge badge-${
            signal === 'bullish' || signal === 'oversold' ? 'green' :
            signal === 'bearish' || signal === 'overbought' ? 'red' :
            'yellow'
          }`}>
            {signal}
          </span>
        )}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem' }}>
        {value}
      </div>
      {description && (
        <div className="text-muted text-small">{description}</div>
      )}
    </div>
  );

  return (
    <div className="card">
      <h2 className="card-title">Technical Indicators</h2>
      <p className="text-muted mb-3">
        Latest values as of {marketData.data[lastIndex].date}
      </p>

      <div className="grid grid-2">
        <IndicatorCard
          title="Current Price"
          value={latestClose.toFixed(4)}
          description={`${marketData.pair}`}
        />

        <IndicatorCard
          title="SMA(20)"
          value={latestSMA20?.toFixed(4) || 'N/A'}
          signal={smaSignal}
          description={smaSignal === 'bullish' 
            ? 'Price above SMA - potential uptrend' 
            : 'Price below SMA - potential downtrend'}
        />

        <IndicatorCard
          title="SMA(50)"
          value={latestSMA50?.toFixed(4) || 'N/A'}
          description="Longer-term moving average"
        />

        <IndicatorCard
          title="RSI(14)"
          value={latestRSI?.toFixed(2) || 'N/A'}
          signal={rsiSignal}
          description={
            rsiSignal === 'overbought' ? 'RSI > 70 - potential reversal down' :
            rsiSignal === 'oversold' ? 'RSI < 30 - potential reversal up' :
            'RSI in neutral zone (30-70)'
          }
        />

        <IndicatorCard
          title="MACD"
          value={latestMACD?.toFixed(6) || 'N/A'}
          signal={macdSignal}
          description={`Signal: ${latestSignal?.toFixed(6) || 'N/A'}, Histogram: ${latestHistogram?.toFixed(6) || 'N/A'}`}
        />

        <IndicatorCard
          title="Bollinger Bands"
          value={bbPosition !== null ? `${bbPosition.toFixed(1)}%` : 'N/A'}
          description={`Upper: ${latestBBUpper?.toFixed(4) || 'N/A'}, Lower: ${latestBBLower?.toFixed(4) || 'N/A'}`}
        />
      </div>

      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '6px',
        border: '1px solid var(--accent-blue)',
      }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent-blue)' }}>
          Manual Verification Instructions
        </h3>
        <p className="text-small text-muted">
          To verify these calculations:
          <br />
          1. <strong>SMA(20)</strong>: Average of last 20 closing prices = {latestSMA20?.toFixed(4)}
          <br />
          2. <strong>RSI(14)</strong>: Compare with reference at tradingview.com
          <br />
          3. <strong>Bollinger Bands</strong>: Middle band should equal SMA(20)
          <br />
          4. Check that indicators match known values for at least one data point
        </p>
      </div>
    </div>
  );
}

export default IndicatorPanel;
