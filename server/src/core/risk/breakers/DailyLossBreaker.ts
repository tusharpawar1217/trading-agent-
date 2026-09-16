/**
 * Daily Loss Circuit Breaker
 * 
 * Trips when daily loss exceeds threshold (default: 2% of starting equity)
 * 
 * WHY 2%?
 * - Lose 2% per day for 5 days = -9.6% (still recoverable)
 * - Lose 5% per day for 3 days = -14.3% (much harder to recover)
 * - Professional prop firms typically use 2-5% daily limits
 * 
 * RESET: Automatic at next session open (start of new trading day)
 *        NOT manual - this is a "cooldown period" breaker
 */

import { CircuitBreaker } from '../CircuitBreaker';
import { CircuitBreakerResult } from '../../../../shared/types/risk';
import { Percentage } from '../../../../shared/types/market';

export class DailyLossBreaker extends CircuitBreaker {
  private startOfDayEquity: number = 0;
  private startOfDayDate: string = '';
  
  constructor(
    private getCurrentEquity: () => Promise<number>,
    private maxDailyLoss: Percentage = 0.02 as Percentage, // 2%
  ) {
    super('Daily Loss Limit', true, false); // Auto-reset daily, not manual
  }
  
  /**
   * Initialize with current equity (call this at start of day)
   */
  async initialize(): Promise<void> {
    this.startOfDayEquity = await this.getCurrentEquity();
    this.startOfDayDate = new Date().toISOString().split('T')[0];
    
    console.log(`📊 Daily Loss Breaker initialized:`);
    console.log(`   Starting equity: $${this.startOfDayEquity.toFixed(2)}`);
    console.log(`   Max loss allowed: ${(this.maxDailyLoss * 100).toFixed(1)}% ($${(this.startOfDayEquity * this.maxDailyLoss).toFixed(2)})`);
    console.log(`   Date: ${this.startOfDayDate}`);
  }
  
  /**
   * Check if we've crossed into a new day (auto-reset if yes)
   */
  private checkNewDay(): void {
    const today = new Date().toISOString().split('T')[0];
    
    if (today !== this.startOfDayDate) {
      console.log(`📅 New trading day detected: ${today}`);
      
      if (this._tripped) {
        console.log(`🔄 Auto-resetting daily loss breaker for new session`);
        this.reset();
      }
      
      // Will be re-initialized on next check
      this.startOfDayDate = today;
      this.startOfDayEquity = 0;
    }
  }
  
  async check(): Promise<CircuitBreakerResult> {
    if (!this.enabled) {
      return { allowed: true };
    }
    
    // Check if new day (auto-reset if yes)
    this.checkNewDay();
    
    if (this._tripped) {
      return {
        allowed: false,
        reason: `Daily loss limit breaker already tripped. Resets at next session open.`,
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
        reason: `Daily loss limit exceeded: -${(lossPct * 100).toFixed(2)}% (limit: -${(this.maxDailyLoss * 100).toFixed(1)}%). Resets at next session open.`,
        metric: {
          name: 'Daily Loss',
          current: lossPct * 100,
          threshold: this.maxDailyLoss * 100,
          unit: '%',
        },
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Get current daily P&L
   */
  async getDailyPnL(): Promise<{ amount: number; percentage: number }> {
    if (this.startOfDayEquity === 0) {
      await this.initialize();
    }
    
    const currentEquity = await this.getCurrentEquity();
    const amount = currentEquity - this.startOfDayEquity;
    const percentage = (amount / this.startOfDayEquity) * 100;
    
    return { amount, percentage };
  }
}
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
