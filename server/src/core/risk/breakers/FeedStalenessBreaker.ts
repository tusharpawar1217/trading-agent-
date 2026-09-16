/**
 * Feed Staleness Circuit Breaker
 * 
 * Trips when no price tick received for N seconds.
 * 
 * WHY THIS MATTERS:
 * A stale feed means you're trading on old data. Your "current price"
 * might be seconds or minutes behind reality. This creates:
 * - Slippage surprise (price moved but you didn't see it)
 * - False signals (indicators calculated on stale data)
 * - Execution at wrong price levels
 * 
 * TRIGGER:
 * No price update for > staleness_threshold seconds
 * (Set N based on data source's normal cadence)
 * 
 * EXAMPLES:
 * - Tick data (sub-second updates): N = 5 seconds is concerning
 * - 1-minute bars: N = 90 seconds (allow 1.5 bars tolerance)
 * - Daily data: N = 86400 seconds (1 day)
 * 
 * EFFECT:
 * Halt all new approvals + alert
 * 
 * RESET:
 * Automatic once feed resumes (fresh price tick received)
 */

import { CircuitBreaker } from '../CircuitBreaker';
import { CircuitBreakerResult } from '../../../../shared/types/risk';
import { Timestamp } from '../../../../shared/types/market';

export class FeedStalenessBreaker extends CircuitBreaker {
  private lastPriceTick: Timestamp = 0;
  private stalenessThreshold: number; // milliseconds
  
  /**
   * @param stalenessThreshold - Max age of last price tick in milliseconds
   * @param checkInterval - How often to check (default: 1000ms)
   */
  constructor(
    stalenessThreshold: number = 10000, // 10 seconds default
  ) {
    super('Feed Staleness', true, false); // Auto-reset when feed resumes
    this.stalenessThreshold = stalenessThreshold;
    this.lastPriceTick = Date.now(); // Initialize to now
  }
  
  /**
   * Call this whenever a new price tick arrives
   */
  onPriceTick(timestamp?: Timestamp): void {
    this.lastPriceTick = timestamp || Date.now();
    
    // Auto-reset if was tripped
    if (this._tripped) {
      console.log(`📡 Feed resumed - auto-resetting staleness breaker`);
      this.reset();
    }
  }
  
  /**
   * Check if feed is stale
   */
  async check(context?: { currentTime?: Timestamp }): Promise<CircuitBreakerResult> {
    if (!this.enabled) {
      return { allowed: true };
    }
    
    const now = context?.currentTime || Date.now();
    const age = now - this.lastPriceTick;
    
    if (age > this.stalenessThreshold) {
      const ageSeconds = Math.round(age / 1000);
      const thresholdSeconds = Math.round(this.stalenessThreshold / 1000);
      
      if (!this._tripped) {
        this.trip(
          `Price feed stale: no tick for ${ageSeconds}s (threshold: ${thresholdSeconds}s)`,
          {
            name: 'Feed Age',
            current: ageSeconds,
            threshold: thresholdSeconds,
            unit: 's',
          }
        );
      }
      
      return {
        allowed: false,
        reason: `Price feed is stale (${ageSeconds}s old, threshold: ${thresholdSeconds}s). Trading halted until feed resumes.`,
        metric: {
          name: 'Feed Age',
          current: ageSeconds,
          threshold: thresholdSeconds,
          unit: 's',
        },
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Get current feed age in seconds
   */
  getFeedAge(): number {
    return (Date.now() - this.lastPriceTick) / 1000;
  }
  
  /**
   * Check if feed is healthy
   */
  isFeedHealthy(): boolean {
    return this.getFeedAge() <= this.stalenessThreshold / 1000;
  }
}
