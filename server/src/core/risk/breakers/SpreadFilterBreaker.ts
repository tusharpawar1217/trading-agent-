/**
 * Spread Filter Circuit Breaker
 * 
 * Blocks trades when spread is abnormally wide (default: 1.5× average)
 * 
 * Why spread matters:
 * - Wide spreads = low liquidity or high volatility
 * - Guaranteed slippage on entry and exit
 * - Example: EUR/USD normally 0.5-1.0 pip spread
 *           During news: 3-10 pips
 *           You lose 6-20 pips immediately (both entry and exit)
 */

import { CircuitBreaker } from '../CircuitBreaker';
import { CircuitBreakerResult } from '../../../../shared/types/risk';
import { Pips } from '../../../../shared/types/market';

interface SpreadHistory {
  spreads: Pips[];
  maxSize: number;
}

export class SpreadFilterBreaker extends CircuitBreaker {
  private spreadHistory: Map<string, SpreadHistory> = new Map();
  private readonly historySize = 20; // Track last 20 spreads
  
  constructor(
    private maxSpreadMultiplier: number = 1.5,
  ) {
    super('Spread Filter', true, false); // Auto-reset when spread normalizes
  }
  
  /**
   * Record current spread for a pair
   */
  recordSpread(pair: string, spread: Pips): void {
    if (!this.spreadHistory.has(pair)) {
      this.spreadHistory.set(pair, {
        spreads: [],
        maxSize: this.historySize,
      });
    }
    
    const history = this.spreadHistory.get(pair)!;
    history.spreads.push(spread);
    
    // Keep only last N spreads
    if (history.spreads.length > history.maxSize) {
      history.spreads.shift();
    }
  }
  
  async check(context: { pair: string; currentSpread: Pips }): Promise<CircuitBreakerResult> {
    if (!this.enabled) {
      return { allowed: true };
    }
    
    const { pair, currentSpread } = context;
    
    // Get spread history
    const history = this.spreadHistory.get(pair);
    
    // Need at least 10 samples to calculate average
    if (!history || history.spreads.length < 10) {
      // Not enough data yet - allow but record
      this.recordSpread(pair, currentSpread);
      return { allowed: true };
    }
    
    // Calculate average spread
    const avgSpread = history.spreads.reduce((a, b) => a + b, 0) / history.spreads.length as Pips;
    const threshold = avgSpread * this.maxSpreadMultiplier as Pips;
    
    // Record current spread
    this.recordSpread(pair, currentSpread);
    
    // Check if current spread exceeds threshold
    if (currentSpread > threshold) {
      const message = `Spread too wide for ${pair}: ${currentSpread.toFixed(1)} pips (avg: ${avgSpread.toFixed(1)}, threshold: ${threshold.toFixed(1)})`;
      
      console.warn(`⚠️  ${message}`);
      
      return {
        allowed: false,
        reason: message,
        metric: {
          name: `${pair} Spread`,
          current: currentSpread,
          threshold: threshold,
          unit: 'pips',
        },
      };
    }
    
    // If was tripped but spread normalized, auto-reset
    if (this._tripped && currentSpread <= threshold) {
      this.reset();
    }
    
    return { allowed: true };
  }
  
  /**
   * Get current average spread for a pair
   */
  getAverageSpread(pair: string): Pips | null {
    const history = this.spreadHistory.get(pair);
    if (!history || history.spreads.length === 0) return null;
    
    return history.spreads.reduce((a, b) => a + b, 0) / history.spreads.length as Pips;
  }
}
