/**
 * Consecutive Loss Circuit Breaker
 * 
 * Trips after N losing trades in a row (default: 5)
 * 
 * Why this matters:
 * - Losing streaks happen even with winning strategies
 * - But 5+ losses in a row might indicate:
 *   • Market regime changed (your strategy no longer works)
 *   • Something broke (bad data, logic error)
 *   • You're tilting (emotional trading)
 * - Better to stop, review, and reset than keep bleeding
 * 
 * Statistics:
 * - With 55% win rate, probability of 5 straight losses = 1.8%
 * - With 50% win rate, probability = 3.1%
 * - So it's rare but not impossible
 */

import { CircuitBreaker } from '../CircuitBreaker';
import { CircuitBreakerResult } from '../../../../shared/types/risk';

export class ConsecutiveLossBreaker extends CircuitBreaker {
  private consecutiveLosses: number = 0;
  private lastTradeResult: 'win' | 'loss' | null = null;
  
  constructor(
    private maxConsecutiveLosses: number = 5,
  ) {
    super('Consecutive Losses', true, true);
  }
  
  /**
   * Record a trade result
   */
  recordTrade(isWin: boolean): void {
    if (isWin) {
      // Reset counter on win
      if (this.consecutiveLosses > 0) {
        console.log(`✅ Winning trade broke losing streak of ${this.consecutiveLosses}`);
      }
      this.consecutiveLosses = 0;
      this.lastTradeResult = 'win';
    } else {
      // Increment on loss
      this.consecutiveLosses++;
      this.lastTradeResult = 'loss';
      
      if (this.consecutiveLosses >= 3) {
        console.warn(`⚠️  ${this.consecutiveLosses} consecutive losses`);
      }
    }
  }
  
  async check(): Promise<CircuitBreakerResult> {
    if (!this.enabled) {
      return { allowed: true };
    }
    
    if (this._tripped) {
      return {
        allowed: false,
        reason: `Consecutive loss breaker already tripped after ${this.maxConsecutiveLosses} losses. Manual reset required.`,
      };
    }
    
    if (this.consecutiveLosses >= this.maxConsecutiveLosses) {
      this.trip(
        `Too many consecutive losses: ${this.consecutiveLosses} in a row`,
        {
          name: 'Consecutive Losses',
          current: this.consecutiveLosses,
          threshold: this.maxConsecutiveLosses,
          unit: 'trades',
        }
      );
      
      return {
        allowed: false,
        reason: `Consecutive loss limit exceeded: ${this.consecutiveLosses} losses in a row (limit: ${this.maxConsecutiveLosses})`,
        metric: {
          name: 'Consecutive Losses',
          current: this.consecutiveLosses,
          threshold: this.maxConsecutiveLosses,
          unit: 'trades',
        },
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Get current streak
   */
  getCurrentStreak(): { count: number; type: 'win' | 'loss' | null } {
    return {
      count: this.consecutiveLosses,
      type: this.lastTradeResult,
    };
  }
  
  /**
   * Reset streak (after manual review)
   */
  resetStreak(): void {
    const previousStreak = this.consecutiveLosses;
    this.consecutiveLosses = 0;
    this.lastTradeResult = null;
    console.log(`🔄 Consecutive loss streak reset (was ${previousStreak})`);
  }
}
