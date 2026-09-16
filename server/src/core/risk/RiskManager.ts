/**
 * Risk Manager - Orchestrates all circuit breakers
 * 
 * Responsibilities:
 * - Register and manage multiple circuit breakers
 * - Check ALL breakers before allowing actions
 * - Provide status dashboard
 * - Handle manual resets
 */

import { CircuitBreaker } from './CircuitBreaker';
import { CircuitBreakerResult, CircuitBreakerStatus, CircuitBreakerType } from '../../../shared/types/risk';

export class RiskManager {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private initialized: boolean = false;
  
  /**
   * Register a circuit breaker
   */
  registerBreaker(breaker: CircuitBreaker, type: CircuitBreakerType): void {
    this.breakers.set(breaker.name, breaker);
    console.log(`📋 Registered circuit breaker: ${breaker.name} (${type})`);
  }
  
  /**
   * Initialize all breakers (call at startup)
   */
  async initialize(): Promise<void> {
    console.log('🔧 Initializing Risk Manager...');
    
    for (const [name, breaker] of this.breakers) {
      // Some breakers need initialization (e.g., DailyLossBreaker needs to record starting equity)
      if ('initialize' in breaker && typeof (breaker as any).initialize === 'function') {
        await (breaker as any).initialize();
      }
    }
    
    this.initialized = true;
    console.log(`✅ Risk Manager initialized with ${this.breakers.size} breakers`);
  }
  
  /**
   * Check ALL breakers before allowing action
   * 
   * Returns first failure, or success if all pass.
   * "Fail-fast" approach: if any breaker says no, we stop.
   */
  async checkAll(context?: any): Promise<CircuitBreakerResult> {
    if (!this.initialized) {
      console.warn('⚠️  Risk Manager not initialized - initializing now...');
      await this.initialize();
    }
    
    for (const [name, breaker] of this.breakers) {
      if (!breaker.enabled) continue;
      
      try {
        const result = await breaker.check(context);
        
        if (!result.allowed) {
          // Breaker tripped - stop immediately
          console.error(`🛑 Action blocked by breaker: ${name}`);
          return result;
        }
      } catch (error) {
        // If breaker check throws, treat as failure (fail-safe)
        console.error(`❌ Error checking breaker "${name}":`, error);
        return {
          allowed: false,
          reason: `Circuit breaker error: ${name} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }
    
    // All breakers passed
    return { allowed: true };
  }
  
  /**
   * Check specific breaker type
   */
  async checkBreaker(name: string, context?: any): Promise<CircuitBreakerResult> {
    const breaker = this.breakers.get(name);
    
    if (!breaker) {
      throw new Error(`Breaker not found: ${name}`);
    }
    
    return breaker.check(context);
  }
  
  /**
   * Get status of all breakers
   */
  getStatus(): CircuitBreakerStatus[] {
    return Array.from(this.breakers.values()).map(breaker => ({
      name: breaker.name,
      type: this.inferType(breaker.name),
      enabled: breaker.enabled,
      tripped: breaker.tripped,
      lastTripTime: breaker.lastTripTime,
      requiresManualReset: breaker.resetRequiresManual,
      currentMetric: undefined, // TODO: Add metric tracking
    }));
  }
  
  /**
   * Get status of specific breaker
   */
  getBreakerStatus(name: string): CircuitBreakerStatus | null {
    const breaker = this.breakers.get(name);
    if (!breaker) return null;
    
    return {
      name: breaker.name,
      type: this.inferType(breaker.name),
      enabled: breaker.enabled,
      tripped: breaker.tripped,
      lastTripTime: breaker.lastTripTime,
      requiresManualReset: breaker.resetRequiresManual,
    };
  }
  
  /**
   * Manually reset a breaker
   */
  resetBreaker(name: string, authorizedBy: string): void {
    const breaker = this.breakers.get(name);
    
    if (!breaker) {
      throw new Error(`Breaker not found: ${name}`);
    }
    
    if (!breaker.tripped) {
      throw new Error(`Breaker "${name}" is not tripped - no reset needed`);
    }
    
    breaker.forceReset(authorizedBy);
  }
  
  /**
   * Reset ALL tripped breakers (use with caution!)
   */
  resetAll(authorizedBy: string): void {
    let resetCount = 0;
    
    for (const [name, breaker] of this.breakers) {
      if (breaker.tripped) {
        breaker.forceReset(authorizedBy);
        resetCount++;
      }
    }
    
    console.log(`🔄 Reset ${resetCount} tripped breaker(s) by ${authorizedBy}`);
  }
  
  /**
   * Enable/disable a breaker
   */
  setEnabled(name: string, enabled: boolean): void {
    const breaker = this.breakers.get(name);
    
    if (!breaker) {
      throw new Error(`Breaker not found: ${name}`);
    }
    
    (breaker as any).enabled = enabled;
    console.log(`${enabled ? '✅' : '⏸️'}  Breaker "${name}" ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Check if trading is allowed (no tripped breakers)
   */
  isTradingAllowed(): boolean {
    for (const breaker of this.breakers.values()) {
      if (breaker.enabled && breaker.tripped) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Get list of tripped breakers
   */
  getTrippedBreakers(): string[] {
    return Array.from(this.breakers.values())
      .filter(b => b.tripped)
      .map(b => b.name);
  }
  
  /**
   * Infer breaker type from name (hacky but works)
   */
  private inferType(name: string): CircuitBreakerType {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('daily') && lowerName.includes('loss')) {
      return CircuitBreakerType.DAILY_LOSS;
    }
    if (lowerName.includes('drawdown')) {
      return CircuitBreakerType.TRAILING_DRAWDOWN;
    }
    if (lowerName.includes('consecutive')) {
      return CircuitBreakerType.CONSECUTIVE_LOSSES;
    }
    if (lowerName.includes('spread')) {
      return CircuitBreakerType.SPREAD_FILTER;
    }
    if (lowerName.includes('news') || lowerName.includes('embargo')) {
      return CircuitBreakerType.NEWS_EMBARGO;
    }
    if (lowerName.includes('position')) {
      return CircuitBreakerType.MAX_POSITIONS;
    }
    
    return CircuitBreakerType.DAILY_LOSS; // Default fallback
  }
}

/**
 * Singleton instance
 */
let riskManagerInstance: RiskManager | null = null;

export function getRiskManager(): RiskManager {
  if (!riskManagerInstance) {
    riskManagerInstance = new RiskManager();
  }
  return riskManagerInstance;
}
