/**
 * Daily Loss Circuit Breaker
 * 
 * Trips when daily loss exceeds threshold (default: 2% of starting equity)
 * 
 * Why 2%?
 * - Lose 2% per day for 5 days = -9.6% (still recoverable)
 * - Lose 5% per day for 3 days = -14.3% (much harder to recover)
 * - Professional prop firms typically use 2-5% daily limits
 */

import { CircuitBreaker } from '../CircuitBreaker';
import { CircuitBreakerResult } from '../../../../shared/types/risk';
import { Percentage } from '../../../../shared/types/market';

export class DailyLossBreaker extends CircuitBreaker {
  private startOfDayEquity: number = 0;
  private startOfDayTimestamp: number = 0;
  
  constructor(
    private getCurrentEquity: () => Promise<number>,
    private maxDailyLoss: Percentage = 0.02 as Percentage, // 2%
  ) {
    super('Daily Loss Limit', true, true);
  }
  
  /**
   * Initialize with current equity (call this at start of day)
   */
  async initialize(): Promise<void> {
    this.startOfDayEquity = await this.getCurrentEquity();
    this.startOfDayTimestamp = Date.now();
    
    console.log(`📊 Daily Loss Breaker initialized:`);
    console.log(`   Starting equity: $${this.startOfDayEquity.toFixed(2)}`);
    console.log(`   Max loss allowed: ${(this.maxDailyLoss * 100).toFixed(1)}% ($${(this.startOfDayEquity * this.maxDailyLoss).toFixed(2)})`);
  }
  
  async check(): Promise<CircuitBreakerResult> {
    if (!this.enabled) {
      return { allowed: true };
    }
    
    if (this._tripped) {
      return {
        allowed: false,
        reason: `Daily loss limit breaker already tripped at ${new Date(this._lastTripTime!).toLocaleTimeString()}. Manual reset required.`,
      };
    }
    
    // Initialize if not already done (fallback)
    if (this.startOfDayEquity === 0) {
      await this.initialize();
    }
    
    const currentEquity = await this.getCurrentEquity();
    const lossAmount = this.startOfDayEquity - currentEquity;
    const lossPct = lossAmount / this.startOfDayEquity;
    
    // Check if threshold exceeded
    if (lossPct >= this.maxDailyLoss) {
      this.trip(
        `Daily loss limit exceeded: ${(lossPct * 100).toFixed(2)}% loss`,
        {
          name: 'Daily Loss',
          current: lossPct * 100,
          threshold: this.maxDailyLoss * 100,
          unit: '%',
        }
      );
      
      return {
        allowed: false,
        reason: `Daily loss limit exceeded: -${(lossPct * 100).toFixed(2)}% (limit: -${(this.maxDailyLoss * 100).toFixed(1)}%)`,
        metric: {
          name: 'Daily Loss',
          current: lossPct * 100,
          threshold: this.maxDailyLoss * 100,
          unit: '%',
        },
      };
    }
    
    // Log current status (not tripped)
    if (lossPct > 0) {
      const warningThreshold = this.maxDailyLoss * 0.75; // 75% of limit
      if (lossPct >= warningThreshold) {
        console.warn(`⚠️  Daily loss approaching limit: -${(lossPct * 100).toFixed(2)}% (limit: -${(this.maxDailyLoss * 100).toFixed(1)}%)`);
      }
    }
    
    return { allowed: true };
  }
  
  /**
   * Reset for new trading day
   */
  async resetForNewDay(): Promise<void> {
    this._tripped = false;
    await this.initialize();
    console.log(`🔄 Daily Loss Breaker reset for new trading day`);
  }
}
