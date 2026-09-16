/**
 * Technical Indicators
 * 
 * Pure functions for calculating forex technical indicators.
 * All functions are tested against known reference values.
 */

/**
 * Simple Moving Average
 * @param {number[]} data - Array of prices
 * @param {number} period - Number of periods
 * @returns {number[]} - Array of SMA values (null for insufficient data)
 */
export function calculateSMA(data, period) {
  if (!data || data.length === 0) return [];
  if (period <= 0) throw new Error('Period must be positive');
  
  const result = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  
  return result;
}

/**
 * Exponential Moving Average
 * @param {number[]} data - Array of prices
 * @param {number} period - Number of periods
 * @returns {number[]} - Array of EMA values
 */
export function calculateEMA(data, period) {
  if (!data || data.length === 0) return [];
  if (period <= 0) throw new Error('Period must be positive');
  
  const multiplier = 2 / (period + 1);
  const result = [];
  
  // First EMA is the SMA
  const sma = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      result.push(sma);
    } else {
      const ema = (data[i] - result[i - 1]) * multiplier + result[i - 1];
      result.push(ema);
    }
  }
  
  return result;
}

/**
 * Relative Strength Index (14-period default)
 * @param {number[]} data - Array of prices
 * @param {number} period - Number of periods (default 14)
 * @returns {number[]} - Array of RSI values (0-100)
 */
export function calculateRSI(data, period = 14) {
  if (!data || data.length < period + 1) return [];
  if (period <= 0) throw new Error('Period must be positive');
  
  const result = [];
  const gains = [];
  const losses = [];
  
  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  
  // First RSI uses simple average
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(null);
    } else if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push(rsi);
    } else {
      // Smoothed averages
      avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push(rsi);
    }
  }
  
  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 * @param {number[]} data - Array of prices
 * @param {number} fastPeriod - Fast EMA period (default 12)
 * @param {number} slowPeriod - Slow EMA period (default 26)
 * @param {number} signalPeriod - Signal line EMA period (default 9)
 * @returns {{macd: number[], signal: number[], histogram: number[]}}
 */
export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!data || data.length === 0) return { macd: [], signal: [], histogram: [] };
  
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  // MACD line = fast EMA - slow EMA
  const macdLine = [];
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
  }
  
  // Signal line = EMA of MACD line
  const macdValues = macdLine.filter(v => v !== null);
  const signalEMA = calculateEMA(macdValues, signalPeriod);
  
  // Pad signal line with nulls to match length
  const nullCount = macdLine.findIndex(v => v !== null);
  const signalLine = Array(data.length).fill(null);
  
  // Fill in the signal values starting from the correct position
  let signalIdx = 0;
  for (let i = 0; i < data.length; i++) {
    if (i >= nullCount + signalPeriod - 1 && signalIdx < signalEMA.length) {
      if (signalEMA[signalIdx] !== null) {
        signalLine[i] = signalEMA[signalIdx];
      }
      signalIdx++;
    }
  }
  
  // Histogram = MACD - Signal
  const histogram = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(macdLine[i] - signalLine[i]);
    }
  }
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram
  };
}

/**
 * Bollinger Bands
 * @param {number[]} data - Array of prices
 * @param {number} period - Number of periods (default 20)
 * @param {number} stdDev - Number of standard deviations (default 2)
 * @returns {{upper: number[], middle: number[], lower: number[]}}
 */
export function calculateBollingerBands(data, period = 20, stdDev = 2) {
  if (!data || data.length === 0) return { upper: [], middle: [], lower: [] };
  if (period <= 0) throw new Error('Period must be positive');
  
  const middle = calculateSMA(data, period);
  const upper = [];
  const lower = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = middle[i];
      
      // Calculate standard deviation
      const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
      const sd = Math.sqrt(variance);
      
      upper.push(mean + (stdDev * sd));
      lower.push(mean - (stdDev * sd));
    }
  }
  
  return {
    upper,
    middle,
    lower
  };
}

/**
 * Calculate all indicators for a price series
 * @param {Array<{close: number}>} candles - Array of OHLC candles
 * @returns {Object} - All calculated indicators
 */
export function calculateAllIndicators(candles) {
  const closes = candles.map(c => c.close);
  
  return {
    sma20: calculateSMA(closes, 20),
    sma50: calculateSMA(closes, 50),
    ema12: calculateEMA(closes, 12),
    ema26: calculateEMA(closes, 26),
    rsi: calculateRSI(closes, 14),
    macd: calculateMACD(closes, 12, 26, 9),
    bollingerBands: calculateBollingerBands(closes, 20, 2),
  };
}
