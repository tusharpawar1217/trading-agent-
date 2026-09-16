/**
 * Intraday Multi-Timeframe Signal Generator
 * 
 * TIMEFRAME STRUCTURE FOR INTRADAY TRADING:
 * - Higher Timeframe (H1): Directional bias (trend filter)
 * - Middle Timeframe (M15): Structure confirmation
 * - Lower Timeframe (M5): Entry timing (where we actually trade)
 * 
 * ALIGNMENT RULES:
 * Signal fires ONLY when all 3 timeframes agree:
 * - H1: Shows trend direction
 * - M15: Confirms with same direction
 * - M5: Gives precise entry
 * 
 * EXAMPLE:
 * H1: Bullish (price above EMA20, RSI > 50)
 * M15: Bullish (confirms H1 direction)
 * M5: Bullish entry signal (EMA crossover, momentum)
 * → BUY signal on M5 chart
 */

import { OHLC, Timeframe, Price, toPrice } from '../../../../shared/types/market';
import { OrderDirection } from '../../../../shared/types/trading';
import { calculateEMA, calculateRSI, calculateATR, calculateMACD } from './indicators';
import { convertToTimeframe } from './timeframeConverter';

export interface IntradaySignal {
  timestamp: number;
  pair: string;
  timeframe: Timeframe; // Entry timeframe (M5)
  direction: OrderDirection;
  strength: number; // 0-100
  entryPrice: Price;
  
  // Multi-timeframe context
  h1Trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  m15Trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  m5Trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  alignment: boolean;
  
  // Technical levels
  stopLoss: Price;
  takeProfit: Price;
  atr: number;
  
  // Indicators snapshot
  indicators: {
    h1: {
      ema20: number;
      rsi: number;
      macd: { value: number; signal: number; histogram: number };
    };
    m15: {
      ema20: number;
      rsi: number;
      macd: { value: number; signal: number; histogram: number };
    };
    m5: {
      ema12: number;
      ema26: number;
      rsi: number;
      atr: number;
    };
  };
  
  // Reason for signal
  reason: string;
}

/**
 * Determine trend from indicators
 */
function determineTrend(
  price: number,
  ema20: number,
  rsi: number,
  macdHist: number
): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  let bullishSignals = 0;
  let bearishSignals = 0;
  
  // Price vs EMA
  if (price > ema20) bullishSignals++;
  else if (price < ema20) bearishSignals++;
  
  // RSI
  if (rsi > 50) bullishSignals++;
  else if (rsi < 50) bearishSignals++;
  
  // MACD histogram
  if (macdHist > 0) bullishSignals++;
  else if (macdHist < 0) bearishSignals++;
  
  if (bullishSignals >= 2) return 'BULLISH';
  if (bearishSignals >= 2) return 'BEARISH';
  return 'NEUTRAL';
}

/**
 * Generate intraday signal from multi-timeframe analysis
 * 
 * @param rawCandles - Raw 1-minute OHLC data (will be converted to H1/M15/M5)
 * @param pair - Currency pair
 * @returns IntradaySignal or null if no signal
 */
export function generateIntradaySignal(
  rawCandles: OHLC[],
  pair: string
): IntradaySignal | null {
  if (rawCandles.length < 200) {
    console.log('Not enough data for intraday signal');
    return null;
  }
  
  // Convert to required timeframes
  const h1Candles = convertToTimeframe(rawCandles, Timeframe.H1);
  const m15Candles = convertToTimeframe(rawCandles, Timeframe.M15);
  const m5Candles = convertToTimeframe(rawCandles, Timeframe.M5);
  
  if (h1Candles.length < 50 || m15Candles.length < 50 || m5Candles.length < 50) {
    console.log('Not enough converted candles');
    return null;
  }
  
  // Calculate indicators for H1
  const h1Closes = h1Candles.map(c => c.close);
  const h1EMA20 = calculateEMA(h1Closes, 20);
  const h1RSI = calculateRSI(h1Closes, 14);
  const h1MACD = calculateMACD(h1Closes);
  
  const h1CurrentPrice = h1Closes[h1Closes.length - 1];
  const h1EMA20Val = h1EMA20[h1EMA20.length - 1]!;
  const h1RSIVal = h1RSI[h1RSI.length - 1]!;
  const h1MACDVal = h1MACD[h1MACD.length - 1]!;
  
  // Calculate indicators for M15
  const m15Closes = m15Candles.map(c => c.close);
  const m15EMA20 = calculateEMA(m15Closes, 20);
  const m15RSI = calculateRSI(m15Closes, 14);
  const m15MACD = calculateMACD(m15Closes);
  
  const m15CurrentPrice = m15Closes[m15Closes.length - 1];
  const m15EMA20Val = m15EMA20[m15EMA20.length - 1]!;
  const m15RSIVal = m15RSI[m15RSI.length - 1]!;
  const m15MACDVal = m15MACD[m15MACD.length - 1]!;
  
  // Calculate indicators for M5
  const m5Closes = m5Candles.map(c => c.close);
  const m5EMA12 = calculateEMA(m5Closes, 12);
  const m5EMA26 = calculateEMA(m5Closes, 26);
  const m5RSI = calculateRSI(m5Closes, 14);
  const m5ATR = calculateATR(m5Candles, 14);
  
  const m5CurrentPrice = m5Closes[m5Closes.length - 1];
  const m5EMA12Val = m5EMA12[m5EMA12.length - 1]!;
  const m5EMA26Val = m5EMA26[m5EMA26.length - 1]!;
  const m5RSIVal = m5RSI[m5RSI.length - 1]!;
  const m5ATRVal = m5ATR[m5ATR.length - 1]!;
  
  // Determine trends
  const h1Trend = determineTrend(h1CurrentPrice, h1EMA20Val, h1RSIVal, h1MACDVal.histogram);
  const m15Trend = determineTrend(m15CurrentPrice, m15EMA20Val, m15RSIVal, m15MACDVal.histogram);
  
  // M5 trend (entry signal)
  let m5Trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  const emaAlignment = m5EMA12Val > m5EMA26Val ? 'BULLISH' : m5EMA12Val < m5EMA26Val ? 'BEARISH' : 'NEUTRAL';
  const rsiCondition = m5RSIVal > 50 ? 'BULLISH' : m5RSIVal < 50 ? 'BEARISH' : 'NEUTRAL';
  
  if (emaAlignment === 'BULLISH' && rsiCondition === 'BULLISH') {
    m5Trend = 'BULLISH';
  } else if (emaAlignment === 'BEARISH' && rsiCondition === 'BEARISH') {
    m5Trend = 'BEARISH';
  }
  
  // Check alignment
  const alignment = (h1Trend === m15Trend) && (m15Trend === m5Trend) && (m5Trend !== 'NEUTRAL');
  
  if (!alignment) {
    // No signal - timeframes don't agree
    return null;
  }
  
  // Generate signal
  const direction = m5Trend === 'BULLISH' ? OrderDirection.BUY : OrderDirection.SELL;
  const entryPrice = toPrice(m5CurrentPrice);
  
  // Calculate stop loss (ATR-based)
  const atrMultiplier = 1.5;
  const stopDistance = m5ATRVal * atrMultiplier;
  const stopLoss = direction === OrderDirection.BUY
    ? toPrice(entryPrice - stopDistance)
    : toPrice(entryPrice + stopDistance);
  
  // Calculate take profit (2:1 R:R)
  const rewardDistance = stopDistance * 2;
  const takeProfit = direction === OrderDirection.BUY
    ? toPrice(entryPrice + rewardDistance)
    : toPrice(entryPrice - rewardDistance);
  
  // Calculate strength (0-100)
  const h1Strength = h1Trend === m5Trend ? 35 : 0;
  const m15Strength = m15Trend === m5Trend ? 35 : 0;
  const m5Strength = 30;
  const strength = h1Strength + m15Strength + m5Strength;
  
  // Build reason
  const reasons: string[] = [];
  if (h1Trend === 'BULLISH') {
    reasons.push('H1 uptrend (price > EMA20, RSI > 50)');
  } else {
    reasons.push('H1 downtrend (price < EMA20, RSI < 50)');
  }
  reasons.push(`M15 confirms ${m15Trend.toLowerCase()} direction`);
  reasons.push(`M5 entry: EMA12 ${m5EMA12Val > m5EMA26Val ? 'above' : 'below'} EMA26`);
  
  return {
    timestamp: Date.now(),
    pair,
    timeframe: Timeframe.M5,
    direction,
    strength,
    entryPrice,
    h1Trend,
    m15Trend,
    m5Trend,
    alignment,
    stopLoss,
    takeProfit,
    atr: m5ATRVal,
    indicators: {
      h1: {
        ema20: h1EMA20Val,
        rsi: h1RSIVal,
        macd: h1MACDVal,
      },
      m15: {
        ema20: m15EMA20Val,
        rsi: m15RSIVal,
        macd: m15MACDVal,
      },
      m5: {
        ema12: m5EMA12Val,
        ema26: m5EMA26Val,
        rsi: m5RSIVal,
        atr: m5ATRVal,
      },
    },
    reason: reasons.join('. '),
  };
}

/**
 * Format signal for display
 */
export function formatIntradaySignal(signal: IntradaySignal): string {
  return `
INTRADAY SIGNAL — ${signal.pair}
====================================

Direction: ${signal.direction}
Entry Timeframe: ${signal.timeframe} (5-minute chart)
Strength: ${signal.strength}/100
Entry Price: ${signal.entryPrice.toFixed(5)}

Stop Loss: ${signal.stopLoss.toFixed(5)} (${Math.abs(signal.entryPrice - signal.stopLoss).toFixed(5)} risk)
Take Profit: ${signal.takeProfit.toFixed(5)} (${Math.abs(signal.takeProfit - signal.entryPrice).toFixed(5)} reward)
Risk:Reward: 1:2
ATR(14): ${signal.atr.toFixed(5)}

MULTI-TIMEFRAME ALIGNMENT:
--------------------------
H1 (1-hour):  ${signal.h1Trend.padEnd(8)} - EMA20: ${signal.indicators.h1.ema20.toFixed(5)}, RSI: ${signal.indicators.h1.rsi.toFixed(1)}
M15 (15-min): ${signal.m15Trend.padEnd(8)} - EMA20: ${signal.indicators.m15.ema20.toFixed(5)}, RSI: ${signal.indicators.m15.rsi.toFixed(1)}
M5 (5-min):   ${signal.m5Trend.padEnd(8)} - EMA12: ${signal.indicators.m5.ema12.toFixed(5)}, EMA26: ${signal.indicators.m5.ema26.toFixed(5)}

Alignment: ${signal.alignment ? '✅ ALL TIMEFRAMES AGREE' : '❌ NO ALIGNMENT'}

REASON:
${signal.reason}

TRADE SETUP:
1. Enter at: ${signal.entryPrice.toFixed(5)} (current M5 price)
2. Set stop: ${signal.stopLoss.toFixed(5)} (${signal.direction === 'BUY' ? 'below' : 'above'} entry)
3. Set target: ${signal.takeProfit.toFixed(5)} (2× risk distance)
4. Position size: Use ATR-based calculator with ${signal.atr.toFixed(5)} ATR
`;
}
