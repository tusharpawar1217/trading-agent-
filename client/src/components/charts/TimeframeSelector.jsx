/**
 * Timeframe Selector Component
 * 
 * Allows user to select different chart timeframes
 */

import React from 'react';

const TIMEFRAMES = [
  { value: 'S1', label: '1s', display: '1 Second' },
  { value: 'S5', label: '5s', display: '5 Seconds' },
  { value: 'S10', label: '10s', display: '10 Seconds' },
  { value: 'S15', label: '15s', display: '15 Seconds' },
  { value: 'S30', label: '30s', display: '30 Seconds' },
  { value: 'M1', label: '1m', display: '1 Minute' },
  { value: 'M5', label: '5m', display: '5 Minutes' },
  { value: 'M15', label: '15m', display: '15 Minutes' },
  { value: 'M30', label: '30m', display: '30 Minutes' },
  { value: 'H1', label: '1h', display: '1 Hour' },
  { value: 'H4', label: '4h', display: '4 Hours' },
  { value: 'D1', label: '1d', display: '1 Day' },
  { value: 'W1', label: '1w', display: '1 Week' },
  { value: 'MN', label: '1M', display: '1 Month' },
];

function TimeframeSelector({ 
  selectedTimeframe = 'M15', 
  onTimeframeChange,
  disabled = false,
}) {
  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      padding: '12px',
      background: '#f5f5f5',
      borderRadius: '8px',
      flexWrap: 'wrap',
    }}>
      <label style={{
        fontWeight: 'bold',
        alignSelf: 'center',
        marginRight: '8px',
      }}>
        Timeframe:
      </label>
      
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf.value}
          onClick={() => onTimeframeChange(tf.value)}
          disabled={disabled}
          title={tf.display}
          style={{
            padding: '6px 12px',
            border: selectedTimeframe === tf.value ? '2px solid #2196F3' : '1px solid #ccc',
            borderRadius: '4px',
            background: selectedTimeframe === tf.value ? '#2196F3' : 'white',
            color: selectedTimeframe === tf.value ? 'white' : 'black',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: selectedTimeframe === tf.value ? 'bold' : 'normal',
            fontSize: '12px',
            transition: 'all 0.2s',
            opacity: disabled ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!disabled && selectedTimeframe !== tf.value) {
              e.target.style.background = '#f0f0f0';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedTimeframe !== tf.value) {
              e.target.style.background = 'white';
            }
          }}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}

export default TimeframeSelector;
export { TIMEFRAMES };
