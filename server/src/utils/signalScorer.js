/**
 * Signal Scorer - Rule-based trading signal generation
 * 
 * Philosophy: Keep trading decisions rule-based and fully explainable.
 * LLM only narrates decisions, never makes them.
 * 
 * Scoring Rules (v1):
 * - RSI oversold (RSI < 30): +1
 * - RSI overbought (RSI > 70): -1
 * - MACD bullish (histogram > 0): +1
 * - MACD bearish (histogram < 0): -1
 * - Trend filter (price > SMA50): +1
 * - Trend filter (price < SMA50): -1
 * - Mean reversion (price ≤ lower BB): +1
 * - Mean reversion (price ≥ upper BB): -1
 * 
 * Verdict: score ≥ +2 → BUY, score ≤ -2 → SELL, otherwise HOLD
 * Confidence: min(100, |score| / 4 * 100)
 */

import { calculateAllIndicators } from './indicators.js';

/**
 * Compute trading signal from market data
 * @param {Object} marketData - Market data with OHLC candles
 * @returns {Object} Signal with verdict, confidence, score, and reasons
 */
export function computeSignal(marketData) {
  if (!marketData || !marketData.data || marketData.data.length === 0) {
    throw new Error('Invalid market data');
  }

  const candles = marketData.data;
  const indicators = calculateAllIndicators(candles);
  const lastIndex = candles.length - 1;
  
  // Get latest values
  const currentPrice = candles[lastIndex].close;
  const rsi = indicators.rsi[lastIndex];
  const macdHistogram = indicators.macd.histogram[lastIndex];
  const sma50 = indicators.sma50[lastIndex];
  const bbUpper = indicators.bollingerBands.upper[lastIndex];
  const bbLower = indicators.bollingerBands.lower[lastIndex];

  // Check if we have enough data
  if (rsi === null || macdHistogram === null || sma50 === null || 
      bbUpper === null || bbLower === null) {
    throw new Error('Insufficient data to compute signal - need at least 50 periods');
  }

  const reasons = [];
  let score = 0;

  // Rule 1: RSI oversold
  if (rsi < 30) {
    score += 1;
    reasons.push({
      rule: 'RSI oversold',
      condition: 'RSI(14) < 30',
      value: rsi.toFixed(2),
      score: +1,
      interpretation: 'Bullish - market may be oversold, potential bounce'
    });
  }

  // Rule 2: RSI overbought
  if (rsi > 70) {
    score -= 1;
    reasons.push({
      rule: 'RSI overbought',
      condition: 'RSI(14) > 70',
      value: rsi.toFixed(2),
      score: -1,
      interpretation: 'Bearish - market may be overbought, potential pullback'
    });
  }

  // Rule 3: MACD bullish
  if (macdHistogram > 0) {
    score += 1;
    reasons.push({
      rule: 'MACD bullish',
      condition: 'MACD histogram > 0',
      value: macdHistogram.toFixed(6),
      score: +1,
      interpretation: 'Bullish - momentum is positive'
    });
  }

  // Rule 4: MACD bearish
  if (macdHistogram < 0) {
    score -= 1;
    reasons.push({
      rule: 'MACD bearish',
      condition: 'MACD histogram < 0',
      value: macdHistogram.toFixed(6),
      score: -1,
      interpretation: 'Bearish - momentum is negative'
    });
  }

  // Rule 5: Trend filter - price above SMA50
  if (currentPrice > sma50) {
    score += 1;
    reasons.push({
      rule: 'Trend filter',
      condition: 'Price > SMA(50)',
      value: `${currentPrice.toFixed(4)} > ${sma50.toFixed(4)}`,
      score: +1,
      interpretation: 'Bullish - price above long-term average, uptrend'
    });
  }

  // Rule 6: Trend filter - price below SMA50
  if (currentPrice < sma50) {
    score -= 1;
    reasons.push({
      rule: 'Trend filter',
      condition: 'Price < SMA(50)',
      value: `${currentPrice.toFixed(4)} < ${sma50.toFixed(4)}`,
      score: -1,
      interpretation: 'Bearish - price below long-term average, downtrend'
    });
  }

  // Rule 7: Mean reversion - price at or below lower Bollinger Band
  if (currentPrice <= bbLower) {
    score += 1;
    reasons.push({
      rule: 'Mean reversion',
      condition: 'Price ≤ Lower Bollinger Band',
      value: `${currentPrice.toFixed(4)} ≤ ${bbLower.toFixed(4)}`,
      score: +1,
      interpretation: 'Bullish - price at lower band, potential mean reversion up'
    });
  }

  // Rule 8: Mean reversion - price at or above upper Bollinger Band
  if (currentPrice >= bbUpper) {
    score -= 1;
    reasons.push({
      rule: 'Mean reversion',
      condition: 'Price ≥ Upper Bollinger Band',
      value: `${currentPrice.toFixed(4)} ≥ ${bbUpper.toFixed(4)}`,
      score: -1,
      interpretation: 'Bearish - price at upper band, potential mean reversion down'
    });
  }

  // Determine verdict
  let verdict = 'HOLD';
  if (score >= 2) {
    verdict = 'BUY';
  } else if (score <= -2) {
    verdict = 'SELL';
  }

  // Calculate confidence: min(100, |score| / 4 * 100)
  const confidence = Math.min(100, Math.abs(score) / 4 * 100);

  return {
    pair: marketData.pair,
    verdict,
    score,
    confidence,
    reasons,
    timestamp: new Date().toISOString(),
    marketData: {
      currentPrice,
      rsi,
      macdHistogram,
      sma50,
      bollingerBands: {
        upper: bbUpper,
        middle: indicators.bollingerBands.middle[lastIndex],
        lower: bbLower,
      }
    }
  };
}

/**
 * Calculate suggested stop loss using ATR (Average True Range)
 * For now, use a simple percentage-based approach
 * TODO: Implement proper ATR-based stop loss in v2
 * 
 * @param {number} entryPrice - Entry price
 * @param {string} direction - 'BUY' or 'SELL'
 * @param {number} atrMultiplier - Multiplier for ATR (default 2)
 * @returns {number} Suggested stop loss price
 */
export function calculateStopLoss(entryPrice, direction, atrMultiplier = 2) {
  // Simple percentage-based stop loss (1%)
  // In v2, this will use ATR from market data
  const stopDistance = entryPrice * 0.01;
  
  if (direction === 'BUY') {
    return entryPrice - stopDistance;
  } else if (direction === 'SELL') {
    return entryPrice + stopDistance;
  }
  
  throw new Error('Invalid direction. Must be BUY or SELL');
}

/**
 * Calculate suggested take profit
 * Uses a simple risk-reward ratio
 * 
 * @param {number} entryPrice - Entry price
 * @param {number} stopLoss - Stop loss price
 * @param {string} direction - 'BUY' or 'SELL'
 * @param {number} riskRewardRatio - Risk:Reward ratio (default 2:1)
 * @returns {number} Suggested take profit price
 */
export function calculateTakeProfit(entryPrice, stopLoss, direction, riskRewardRatio = 2) {
  const riskDistance = Math.abs(entryPrice - stopLoss);
  const rewardDistance = riskDistance * riskRewardRatio;
  
  if (direction === 'BUY') {
    return entryPrice + rewardDistance;
  } else if (direction === 'SELL') {
    return entryPrice - rewardDistance;
  }
  
  throw new Error('Invalid direction. Must be BUY or SELL');
}
