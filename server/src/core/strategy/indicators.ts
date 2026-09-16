/**
 * Technical Indicators (TypeScript version)
 * 
 * Pure functions for calculating forex technical indicators.
 * All functions tested against known reference values.
 */

import { Price, OHLC, Pips, toPrice, toPips } from '../../../shared/types/market';

/**
 * Simple Moving Average
 */
export function calculateSMA(data: Price[], period: number): (Price | null)[] {
  if (!data || data.length === 0) return [];
  if (period <= 0) throw new Error('Period must be positive');
  
  const result: (Price | null)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(toPrice(sum / period));
    }
  }
  
  return result;
}

/**
 * Exponential Moving Average
 */
export function calculateEMA(data: Price[], period: number): (Price | null)[] {
  if (!data || data.length === 0) return [];
  if (period <= 0) throw new Error('Period must be positive');
  
  const multiplier = 2 / (period + 1);
  const result: (Price | null)[] = [];
  
  const sma = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      result.push(toPrice(sma));
    } else {
      const ema = (data[i] - result[i - 1]!) * multiplier + result[i - 1]!;
      result.push(toPrice(ema));
    }
  }
  
  return result;
}

/**
 * Average True Range (ATR)
 * 
 * Measures volatility by calculating the average of true ranges.
 * True Range = max(high - low, |high - prev_close|, |low - prev_close|)
 * 
 * @param candles - OHLC data
 * @param period - Period (default 14)
 * @returns Array of ATR values in pips
 */
export function calculateATR(candles: OHLC[], period: number = 14): (Pips | null)[] {
  if (!candles || candles.length < 2) return [];
  
  const trueRanges: Pips[] = [];
  
  // Calculate True Range for each candle
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(toPips(tr * 10000)); // Convert to pips
  }
  
  const result: (Pips | null)[] = [null]; // First candle has no ATR
  
  if (trueRanges.length >= period) {
    // First ATR is simple average
    let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result.push(toPips(atr));
    
    // Subsequent ATRs use smoothed average (Wilder's method)
    for (let i = period; i < trueRanges.length; i++) {
      atr = (atr * (period - 1) + trueRanges[i]) / period;
      result.push(toPips(atr));
    }
    
    // Fill remaining with nulls
    while (result.length < candles.length) {
      result.push(null);
    }
  }
  
  return result;
}

/**
 * Relative Strength Index
 */
export function calculateRSI(data: Price[], period: number = 14): (number | null)[] {
  if (!data || data.length < period + 1) return [];
  
  const result: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  
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
 */
export function calculateMACD(
  data: Price[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  if (!data || data.length === 0) {
    return { macd: [], signal: [], histogram: [] };
  }
  
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  const macdLine: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(fastEMA[i]! - slowEMA[i]!);
    }
  }
  
  const macdValues = macdLine.filter(v => v !== null) as number[];
  const macdPrices = macdValues.map(v => toPrice(v));
  const signalEMA = calculateEMA(macdPrices, signalPeriod);
  
  const nullCount = macdLine.findIndex(v => v !== null);
  const signalLine: (number | null)[] = Array(data.length).fill(null);
  
  let signalIdx = 0;
  for (let i = 0; i < data.length; i++) {
    if (i >= nullCount + signalPeriod - 1 && signalIdx < signalEMA.length) {
      if (signalEMA[signalIdx] !== null) {
        signalLine[i] = signalEMA[signalIdx];
      }
      signalIdx++;
    }
  }
  
  const histogram: (number | null)[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(macdLine[i]! - signalLine[i]!);
    }
  }
  
  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  data: Price[],
  period: number = 20,
  stdDev: number = 2
): {
  upper: (Price | null)[];
  middle: (Price | null)[];
  lower: (Price | null)[];
} {
  if (!data || data.length === 0) {
    return { upper: [], middle: [], lower: [] };
  }
  
  const middle = calculateSMA(data, period);
  const upper: (Price | null)[] = [];
  const lower: (Price | null)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = middle[i]!;
      
      const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
      const sd = Math.sqrt(variance);
      
      upper.push(toPrice(mean + (stdDev * sd)));
      lower.push(toPrice(mean - (stdDev * sd)));
    }
  }
  
  return { upper, middle, lower };
}

/**
 * Calculate all indicators for a price series
 */
export function calculateAllIndicators(candles: OHLC[]) {
  const closes = candles.map(c => c.close);
  
  return {
    sma20: calculateSMA(closes, 20),
    sma50: calculateSMA(closes, 50),
    ema12: calculateEMA(closes, 12),
    ema26: calculateEMA(closes, 26),
    rsi: calculateRSI(closes, 14),
    macd: calculateMACD(closes, 12, 26, 9),
    bollingerBands: calculateBollingerBands(closes, 20, 2),
    atr: calculateATR(candles, 14),
  };
}
