/**
 * Multi-Timeframe Analysis
 * 
 * Implements timeframe alignment for trading signals:
 * - Daily (D1): Directional bias
 * - 4-Hour (H4): Structure/confirmation
 * - 15-Minute (M15): Entry timing
 * 
 * Signal only fires when all timeframes agree on direction.
 */

import { OHLC, Timeframe } from '../../../shared/types/market';
import { OrderDirection } from '../../../shared/types/trading';
import { calculateSMA, calculateEMA, calculateRSI } from './indicators';

export enum TrendDirection {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL',
}

export interface TimeframeTrend {
  timeframe: Timeframe;
  direction: TrendDirection;
  strength: number; // 0-100
  indicators: {
    sma20: number | null;
    sma50: number | null;
    ema12: number | null;
    rsi: number | null;
  };
}

export interface MultiTimeframeAnalysis {
  daily: TimeframeTrend;
  fourHour: TimeframeTrend;
  fifteenMin: TimeframeTrend;
  alignment: boolean; // True if all agree
  consensus: TrendDirection;
  signal: OrderDirection | null;
}

/**
 * Determine trend direction from indicators
 * 
 * Rules:
 * - Bullish: Price > SMA20 > SMA50, RSI > 50
 * - Bearish: Price < SMA20 < SMA50, RSI < 50
 * - Neutral: Mixed signals
 */
function determineTrend(candles: OHLC[]): TimeframeTrend {
  if (candles.length < 50) {
    return {
      timeframe: Timeframe.M15,
      direction: TrendDirection.NEUTRAL,
      strength: 0,
      indicators: { sma20: null, sma50: null, ema12: null, rsi: null },
    };
  }

  const closes = candles.map(c => c.close);
  const currentPrice = closes[closes.length - 1];
  
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const ema12 = calculateEMA(closes, 12);
  const rsi = calculateRSI(closes, 14);
  
  const sma20Val = sma20[sma20.length - 1];
  const sma50Val = sma50[sma50.length - 1];
  const ema12Val = ema12[ema12.length - 1];
  const rsiVal = rsi[rsi.length - 1];
  
  let direction = TrendDirection.NEUTRAL;
  let strength = 50;
  
  if (sma20Val && sma50Val && rsiVal) {
    const bullishSignals = [
      currentPrice > sma20Val,
      sma20Val > sma50Val,
      rsiVal > 50,
      currentPrice > ema12Val!,
    ];
    
    const bearishSignals = [
      currentPrice < sma20Val,
      sma20Val < sma50Val,
      rsiVal < 50,
      currentPrice < ema12Val!,
    ];
    
    const bullishCount = bullishSignals.filter(s => s).length;
    const bearishCount = bearishSignals.filter(s => s).length;
    
    if (bullishCount >= 3) {
      direction = TrendDirection.BULLISH;
      strength = 50 + (bullishCount * 12.5);
    } else if (bearishCount >= 3) {
      direction = TrendDirection.BEARISH;
      strength = 50 + (bearishCount * 12.5);
    }
  }
  
  return {
    timeframe: Timeframe.M15, // Will be overridden
    direction,
    strength,
    indicators: {
      sma20: sma20Val ?? null,
      sma50: sma50Val ?? null,
      ema12: ema12Val ?? null,
      rsi: rsiVal ?? null,
    },
  };
}

/**
 * Analyze multiple timeframes
 * 
 * Agreement rule:
 * - All 3 timeframes must show same direction (BULLISH or BEARISH)
 * - If any timeframe is NEUTRAL or conflicts, no signal
 * 
 * @param dailyCandles - Daily timeframe data
 * @param fourHourCandles - 4-hour timeframe data
 * @param fifteenMinCandles - 15-minute timeframe data
 * @returns Multi-timeframe analysis with signal
 */
export function analyzeMultiTimeframe(
  dailyCandles: OHLC[],
  fourHourCandles: OHLC[],
  fifteenMinCandles: OHLC[]
): MultiTimeframeAnalysis {
  const daily = { ...determineTrend(dailyCandles), timeframe: Timeframe.D1 };
  const fourHour = { ...determineTrend(fourHourCandles), timeframe: Timeframe.H4 };
  const fifteenMin = { ...determineTrend(fifteenMinCandles), timeframe: Timeframe.M15 };
  
  // Check alignment
  const allBullish =
    daily.direction === TrendDirection.BULLISH &&
    fourHour.direction === TrendDirection.BULLISH &&
    fifteenMin.direction === TrendDirection.BULLISH;
  
  const allBearish =
    daily.direction === TrendDirection.BEARISH &&
    fourHour.direction === TrendDirection.BEARISH &&
    fifteenMin.direction === TrendDirection.BEARISH;
  
  const alignment = allBullish || allBearish;
  
  let consensus = TrendDirection.NEUTRAL;
  let signal: OrderDirection | null = null;
  
  if (allBullish) {
    consensus = TrendDirection.BULLISH;
    signal = OrderDirection.BUY;
  } else if (allBearish) {
    consensus = TrendDirection.BEARISH;
    signal = OrderDirection.SELL;
  }
  
  return {
    daily,
    fourHour,
    fifteenMin,
    alignment,
    consensus,
    signal,
  };
}

/**
 * Check if a signal is valid across timeframes
 * 
 * @param analysis - Multi-timeframe analysis result
 * @returns True if signal should be executed
 */
export function isSignalValid(analysis: MultiTimeframeAnalysis): boolean {
  return analysis.alignment && analysis.signal !== null;
}

/**
 * Get minimum strength across all timeframes
 */
export function getMinimumStrength(analysis: MultiTimeframeAnalysis): number {
  return Math.min(
    analysis.daily.strength,
    analysis.fourHour.strength,
    analysis.fifteenMin.strength
  );
}
