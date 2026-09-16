/**
 * Trading Calculations
 * 
 * Core mathematical functions for position sizing, stop loss, take profit.
 * All derivations documented inline.
 */

import { Price, Pips, Percentage, toPrice, toPips } from '../../../shared/types/market';
import { OrderDirection } from '../../../shared/types/trading';

/**
 * Convert price difference to pips
 * 
 * @param priceDiff - Difference in price
 * @param pipValue - Pip value for the pair (0.0001 for most, 0.01 for JPY)
 * @returns Pips
 */
export function priceToPips(priceDiff: number, pipValue: number): Pips {
  return toPips(Math.abs(priceDiff) / pipValue);
}

/**
 * Convert pips to price difference
 * 
 * @param pips - Number of pips
 * @param pipValue - Pip value for the pair
 * @returns Price difference
 */
export function pipsToPrice(pips: Pips, pipValue: number): number {
  return pips * pipValue;
}

/**
 * Calculate ATR-based stop loss
 * 
 * Derivation:
 * - ATR measures typical volatility over N periods
 * - Multiplier (1.5-2.0) gives breathing room vs noise
 * - Tighter multiplier (1.0) = more stops hit
 * - Wider multiplier (3.0) = larger losses when wrong
 * - 1.5-2.0 is sweet spot for most strategies
 * 
 * @param entryPrice - Entry price
 * @param direction - BUY or SELL
 * @param atr - Current ATR value in pips
 * @param multiplier - ATR multiplier (1.5-2.0 typical)
 * @param pipValue - Pip value for the pair
 * @returns Stop loss price
 */
export function calculateATRStopLoss(
  entryPrice: Price,
  direction: OrderDirection,
  atr: Pips,
  multiplier: number,
  pipValue: number
): Price {
  const stopDistance = pipsToPrice(toPips(atr * multiplier), pipValue);
  
  if (direction === OrderDirection.BUY) {
    return toPrice(entryPrice - stopDistance);
  } else {
    return toPrice(entryPrice + stopDistance);
  }
}

/**
 * Calculate take profit based on risk:reward ratio
 * 
 * @param entryPrice - Entry price
 * @param stopLoss - Stop loss price
 * @param direction - BUY or SELL
 * @param riskRewardRatio - Risk:Reward ratio (e.g., 2.0 = 2:1)
 * @returns Take profit price
 */
export function calculateTakeProfit(
  entryPrice: Price,
  stopLoss: Price,
  direction: OrderDirection,
  riskRewardRatio: number
): Price {
  const riskDistance = Math.abs(entryPrice - stopLoss);
  const rewardDistance = riskDistance * riskRewardRatio;
  
  if (direction === OrderDirection.BUY) {
    return toPrice(entryPrice + rewardDistance);
  } else {
    return toPrice(entryPrice - rewardDistance);
  }
}

/**
 * Calculate position size based on risk
 * 
 * Formula derivation:
 * ==================
 * Goal: Risk fixed % of account per trade (e.g., 1%)
 * 
 * Given:
 * - Account equity: $10,000
 * - Risk per trade: 1% = $100
 * - Stop loss: 50 pips
 * - Pip value: $10/pip for 1 standard lot (100,000 units)
 * 
 * Calculate:
 * 1. Risk amount = $10,000 × 0.01 = $100
 * 2. Stop loss value = 50 pips × $10/pip × position_size = $500 × position_size
 * 3. Solve: $100 = $500 × position_size
 *    position_size = $100 / $500 = 0.2 lots
 * 
 * General formula:
 * position_size = (equity × risk_pct) / (stop_loss_pips × pip_value_per_lot)
 * 
 * Where pip_value_per_lot = contract_size × pip_size
 * 
 * @param equity - Account equity
 * @param riskPct - Max risk per trade (e.g., 0.01 = 1%)
 * @param stopLossPips - Stop loss distance in pips
 * @param pipValue - Pip value for 1 full pip (0.0001 for EUR/USD)
 * @param contractSize - Contract size (100,000 for standard lot)
 * @returns Position size in lots
 */
export function calculatePositionSize(
  equity: number,
  riskPct: Percentage,
  stopLossPips: Pips,
  pipValue: number,
  contractSize: number = 100000
): number {
  // Risk amount in account currency
  const riskAmount = equity * riskPct;
  
  // Value of 1 pip for 1 full contract
  const pipValuePerLot = pipValue * contractSize;
  
  // Total value at risk if stop loss hit
  const stopLossValue = stopLossPips * pipValuePerLot;
  
  if (stopLossValue === 0) {
    throw new Error('Stop loss value cannot be zero');
  }
  
  // Calculate position size in lots
  const positionSize = riskAmount / stopLossValue;
  
  // Round to nearest 0.01 lot (1 micro lot)
  return Math.round(positionSize * 100) / 100;
}

/**
 * Calculate ATR-based position size (combines ATR stop with position sizing)
 * 
 * This is the recommended way to size positions:
 * 1. ATR determines stop loss distance (adapts to volatility)
 * 2. Position size adjusted so risk = fixed % of account
 * 
 * Example:
 * - High volatility (ATR = 100 pips) → smaller position size
 * - Low volatility (ATR = 30 pips) → larger position size
 * - But risk is always 1% regardless of volatility
 * 
 * @param equity - Account equity
 * @param riskPct - Risk per trade (e.g., 0.01 = 1%)
 * @param atr - Current ATR in pips
 * @param atrMultiplier - Stop loss multiplier (1.5-2.0)
 * @param pipValue - Pip value for the pair
 * @param contractSize - Contract size (100,000 standard)
 * @returns Position size in lots
 */
export function calculateATRPositionSize(
  equity: number,
  riskPct: Percentage,
  atr: Pips,
  atrMultiplier: number,
  pipValue: number,
  contractSize: number = 100000
): number {
  // Stop loss distance based on ATR
  const stopLossPips = toPips(atr * atrMultiplier);
  
  // Calculate position size for that stop loss
  return calculatePositionSize(
    equity,
    riskPct,
    stopLossPips,
    pipValue,
    contractSize
  );
}

/**
 * Calculate risk amount in account currency
 * 
 * @param entryPrice - Entry price
 * @param stopLoss - Stop loss price
 * @param positionSize - Position size in lots
 * @param pipValue - Pip value
 * @param contractSize - Contract size
 * @returns Risk amount in account currency
 */
export function calculateRiskAmount(
  entryPrice: Price,
  stopLoss: Price,
  positionSize: number,
  pipValue: number,
  contractSize: number = 100000
): number {
  const stopLossPips = priceToPips(entryPrice - stopLoss, pipValue);
  const pipValuePerLot = pipValue * contractSize;
  return stopLossPips * pipValuePerLot * positionSize;
}

/**
 * Calculate reward amount in account currency
 * 
 * @param entryPrice - Entry price
 * @param takeProfit - Take profit price
 * @param positionSize - Position size in lots
 * @param pipValue - Pip value
 * @param contractSize - Contract size
 * @returns Reward amount in account currency
 */
export function calculateRewardAmount(
  entryPrice: Price,
  takeProfit: Price,
  positionSize: number,
  pipValue: number,
  contractSize: number = 100000
): number {
  const takeProfitPips = priceToPips(takeProfit - entryPrice, pipValue);
  const pipValuePerLot = pipValue * contractSize;
  return takeProfitPips * pipValuePerLot * positionSize;
}
