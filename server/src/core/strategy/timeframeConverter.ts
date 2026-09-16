/**
 * Timeframe Converter
 * 
 * Converts OHLC data between different timeframes.
 * E.g., convert 1-minute bars to 5-minute, 15-minute, 1-hour, etc.
 */

import { OHLC, Timeframe, Timestamp, toTimestamp } from '../../../shared/types/market';

/**
 * Get duration in milliseconds for a timeframe
 */
export function getTimeframeDuration(timeframe: Timeframe): number {
  const durations: Record<Timeframe, number> = {
    [Timeframe.S1]: 1000,
    [Timeframe.S5]: 5000,
    [Timeframe.S10]: 10000,
    [Timeframe.S15]: 15000,
    [Timeframe.S30]: 30000,
    [Timeframe.M1]: 60000,
    [Timeframe.M5]: 300000,
    [Timeframe.M15]: 900000,
    [Timeframe.M30]: 1800000,
    [Timeframe.H1]: 3600000,
    [Timeframe.H4]: 14400000,
    [Timeframe.D1]: 86400000,
    [Timeframe.W1]: 604800000,
    [Timeframe.MN]: 2592000000, // 30 days
  };
  
  return durations[timeframe];
}

/**
 * Round timestamp down to timeframe boundary
 * 
 * Example: 10:37 with M15 → 10:30
 */
export function roundTimestampToTimeframe(
  timestamp: Timestamp,
  timeframe: Timeframe
): Timestamp {
  const duration = getTimeframeDuration(timeframe);
  return toTimestamp(Math.floor(timestamp / duration) * duration);
}

/**
 * Convert OHLC data to a higher timeframe
 * 
 * Example: Convert M1 bars to M15 bars
 * 
 * @param candles - Source candles (must be sorted by timestamp ascending)
 * @param targetTimeframe - Target timeframe (must be >= source timeframe)
 * @returns Converted candles
 */
export function convertToTimeframe(
  candles: OHLC[],
  targetTimeframe: Timeframe
): OHLC[] {
  if (candles.length === 0) return [];
  
  const result: OHLC[] = [];
  let currentBar: OHLC | null = null;
  let currentBoundary: Timestamp | null = null;
  
  for (const candle of candles) {
    const boundary = roundTimestampToTimeframe(candle.timestamp, targetTimeframe);
    
    if (currentBoundary === null || boundary !== currentBoundary) {
      // Start new bar
      if (currentBar) {
        result.push(currentBar);
      }
      
      currentBar = {
        timestamp: boundary,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
      };
      currentBoundary = boundary;
    } else {
      // Update current bar
      if (currentBar) {
        currentBar.high = Math.max(currentBar.high, candle.high);
        currentBar.low = Math.min(currentBar.low, candle.low);
        currentBar.close = candle.close; // Last close in period
        currentBar.volume = (currentBar.volume || 0) + (candle.volume || 0);
      }
    }
  }
  
  // Add final bar
  if (currentBar) {
    result.push(currentBar);
  }
  
  return result;
}

/**
 * Get the most recent N complete bars for a timeframe
 * 
 * Excludes the current incomplete bar.
 */
export function getCompleteBars(
  candles: OHLC[],
  timeframe: Timeframe,
  count: number
): OHLC[] {
  const converted = convertToTimeframe(candles, timeframe);
  
  // Remove last bar (may be incomplete)
  if (converted.length > 0) {
    converted.pop();
  }
  
  // Return last N bars
  return converted.slice(-count);
}

/**
 * Check if a candle is complete for a given timeframe
 */
export function isCandleComplete(
  timestamp: Timestamp,
  timeframe: Timeframe
): boolean {
  const duration = getTimeframeDuration(timeframe);
  const boundary = roundTimestampToTimeframe(timestamp, timeframe);
  const nextBoundary = toTimestamp(boundary + duration);
  
  return timestamp >= nextBoundary;
}
