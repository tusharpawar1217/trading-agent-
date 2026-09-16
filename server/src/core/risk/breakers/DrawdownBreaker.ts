/**
 * Trailing Drawdown Circuit Breaker
 * 
 * Trips when equity falls X% from its peak (default: 10%)
 * 
 * Why trailing drawdown matters:
 * - Daily loss limit resets each day
 * - But slow bleed across days still hurts
 * - Example: Lose 1.5% for 7 days = -10.1% total
 *           Daily breaker never trips, but account is down 10%
 * - Trailing drawdown catches this pattern
 * 
 * Why 10%?
 * - Professional prop firms typically cut traders at 8-10%
 * - Deeper drawdowns are psychologically and mathematically harder to recover
 * - Down 10% → need 11.1% gain to break even
 * - Down 20% → need 25% gain
 * - Down 50% → need 100% gain (ouch)
 */

import { CircuitBreaker } from '../CircuitBreaker';
import { CircuitBreakerResult } from '../../../../shared/types/risk';
import { Percentage } from '../../../../shared/types/market';

export class DrawdownBreaker extends CircuitBreaker {
  private peakEquity: number = 0;
  private peakEquityTimestamp: number = 0;
  
  constructor(
    private getCurrentEquity: () => Promise<number>,
    private maxDrawdown: Percentage = 0.10 as Percentage, // 10%
  ) {
    super('Trailing Drawdown', true, true);
  }
  
  /**
   * Initialize with current equity as peak
   */
  async initialize(): Promise<void> {
    const currentEquity = await this.getCurrentEquity();
    this.peakEquity = currentEquity;
    this.peakEquityTimestamp = Date.now();
    
    console.log(`📊 Drawdown Breaker initialized:`);
    console.log(`   Peak equity: $${this.peakEquity.toFixed(2)}`);
    console.log(`   Max drawdown: ${(this.maxDrawdown * 100).toFixed(1)}%`);
  }
  
  async check(): Promise<CircuitBreakerResult> {
    if (!this.enabled) {
      return { allowed: true };
    }
    
    if (this._tripped) {
      return {
        allowed: false,
        reason: `Drawdown limit breaker already tripped at ${new Date(this._lastTripTime!).toLocaleTimeString()}. Manual reset required.`,
      };
    }
    
    // Initialize if not already done
    if (this.peakEquity === 0) {
      await this.initialize();
    }
    
    const currentEquity = await this.getCurrentEquity();
    
    // Update peak if new high
    if (currentEquity > this.peakEquity) {
      this.peakEquity = currentEquity;
      this.peakEquityTimestamp = Date.now();
      console.log(`📈 New equity peak: $${this.peakEquity.toFixed(2)}`);
    }
    
    // Calculate drawdown from peak
    const drawdownAmount = this.peakEquity - currentEquity;
    const drawdownPct = drawdownAmount / this.peakEquity;
    
    // Check if threshold exceeded
    if (drawdownPct >= this.maxDrawdown) {
      this.trip(
        `Drawdown limit exceeded: ${(drawdownPct * 100).toFixed(2)}% from peak`,
        {
          name: 'Drawdown from Peak',
          current: drawdownPct * 100,
          threshold: this.maxDrawdown * 100,
          unit: '%',
        }
      );
      
      return {
        allowed: false,
        reason: `Drawdown limit exceeded: -${(drawdownPct * 100).toFixed(2)}% from peak of $${this.peakEquity.toFixed(2)}`,
        metric: {
          name: 'Drawdown',
          current: drawdownPct * 100,
          threshold: this.maxDrawdown * 100,
          unit: '%',
        },
      };
    }
    
    // Log warnings at 50%, 75%, 90% of limit
    if (drawdownPct > 0) {
      const warningLevels = [0.50, 0.75, 0.90];
      for (const level of warningLevels) {
        const warningThreshold = this.maxDrawdown * level;
        if (drawdownPct >= warningThreshold && drawdownPct < warningThreshold * 1.1) {
          console.warn(`⚠️  Drawdown at ${(level * 100).toFixed(0)}% of limit: -${(drawdownPct * 100).toFixed(2)}% (limit: -${(this.maxDrawdown * 100).toFixed(1)}%)`);
          break;
        }
      }
    }
    
    return { allowed: true };
  }
}
