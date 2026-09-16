/**
 * Market Data Types
 * 
 * Branded types prevent accidentally mixing incompatible values:
 * - Price (e.g., 1.1000) cannot be passed where Pips (e.g., 50) expected
 * - Compiler enforces correct usage at build time
 */

// Branded types for type safety
export type Price = number & { readonly __brand: 'Price' };
export type Pips = number & { readonly __brand: 'Pips' };
export type Percentage = number & { readonly __brand: 'Percentage' };
export type Timestamp = number & { readonly __brand: 'Timestamp' };

/**
 * Supported timeframes from 1 second to 1 week
 */
export enum Timeframe {
  S1 = '1s',    // 1 second
  S5 = '5s',
  S15 = '15s',
  S30 = '30s',
  M1 = '1m',    // 1 minute
  M5 = '5m',
  M15 = '15m',
  M30 = '30m',
  H1 = '1h',    // 1 hour
  H4 = '4h',
  H8 = '8h',
  D1 = '1d',    // 1 day
  W1 = '1w',    // 1 week
  MN = '1M',    // 1 month
}

/**
 * OHLC candlestick data
 */
export interface OHLC {
  timestamp: Timestamp;
  open: Price;
  high: Price;
  low: Price;
  close: Price;
  volume?: number;
}

/**
 * Currency pair definition
 */
export interface CurrencyPair {
  symbol: string;      // e.g., "EUR/USD"
  base: string;        // e.g., "EUR"
  quote: string;       // e.g., "USD"
  pipValue: Pips;      // e.g., 0.0001 for most pairs, 0.01 for JPY pairs
  pipPosition: number; // e.g., 4 for EURUSD, 2 for USDJPY
}

/**
 * Real-time quote with bid/ask spread
 */
export interface Quote {
  pair: CurrencyPair;
  bid: Price;
  ask: Price;
  spread: Pips;
  timestamp: Timestamp;
}

/**
 * Helper functions for type conversion
 */
export function toPrice(value: number): Price {
  return value as Price;
}

export function toPips(value: number): Pips {
  return value as Pips;
}

export function toPercentage(value: number): Percentage {
  if (value < 0 || value > 1) {
    throw new Error(`Invalid percentage: ${value}. Must be between 0 and 1.`);
  }
  return value as Percentage;
}

export function toTimestamp(value: number | Date): Timestamp {
  if (value instanceof Date) {
    return value.getTime() as Timestamp;
  }
  return value as Timestamp;
}

/**
 * Get timeframe in seconds
 */
export function timeframeToSeconds(tf: Timeframe): number {
  const map: Record<Timeframe, number> = {
    [Timeframe.S1]: 1,
    [Timeframe.S5]: 5,
    [Timeframe.S15]: 15,
    [Timeframe.S30]: 30,
    [Timeframe.M1]: 60,
    [Timeframe.M5]: 300,
    [Timeframe.M15]: 900,
    [Timeframe.M30]: 1800,
    [Timeframe.H1]: 3600,
    [Timeframe.H4]: 14400,
    [Timeframe.H8]: 28800,
    [Timeframe.D1]: 86400,
    [Timeframe.W1]: 604800,
    [Timeframe.MN]: 2592000, // Approximate
  };
  return map[tf];
}
