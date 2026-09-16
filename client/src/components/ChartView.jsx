import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateAllIndicators } from '../utils/indicators';

function ChartView({ marketData }) {
  if (!marketData || !marketData.data) {
    return null;
  }

  const indicators = calculateAllIndicators(marketData.data);
  
  // Prepare chart data
  const chartData = marketData.data.map((candle, index) => ({
    date: candle.date,
    close: candle.close,
    sma20: indicators.sma20[index],
    bbUpper: indicators.bollingerBands.upper[index],
    bbMiddle: indicators.bollingerBands.middle[index],
    bbLower: indicators.bollingerBands.lower[index],
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        padding: '0.75rem',
      }}>
        <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
          {payload[0].payload.date}
        </p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color, fontSize: '0.875rem' }}>
            {entry.name}: {entry.value?.toFixed(4) || 'N/A'}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="card">
      <h2 className="card-title">
        {marketData.pair} - Price & Indicators
      </h2>
      <p className="text-muted mb-2">
        Data source: {marketData.source} • {marketData.data.length} days
      </p>
      
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis 
            dataKey="date" 
            stroke="var(--text-secondary)"
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis 
            stroke="var(--text-secondary)"
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            domain={['auto', 'auto']}
            tickFormatter={(value) => value.toFixed(4)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '1rem' }}
            iconType="line"
          />
          
          {/* Bollinger Bands */}
          <Line 
            type="monotone" 
            dataKey="bbUpper" 
            stroke="#f59e0b" 
            strokeWidth={1}
            dot={false}
            name="BB Upper"
            strokeDasharray="5 5"
          />
          <Line 
            type="monotone" 
            dataKey="bbLower" 
            stroke="#f59e0b" 
            strokeWidth={1}
            dot={false}
            name="BB Lower"
            strokeDasharray="5 5"
          />
          
          {/* SMA 20 (same as BB middle) */}
          <Line 
            type="monotone" 
            dataKey="sma20" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={false}
            name="SMA(20)"
          />
          
          {/* Close price */}
          <Line 
            type="monotone" 
            dataKey="close" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={false}
            name="Close"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ChartView;
