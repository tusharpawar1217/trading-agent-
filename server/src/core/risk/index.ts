/**
 * Risk Module - Central export point
 * 
 * Exports:
 * - RiskManager singleton
 * - Circuit breaker classes
 * - Risk utility functions
 */

import { RiskManager } from './RiskManager';
import { DailyLossBreaker } from './breakers/DailyLossBreaker';
import { DrawdownBreaker } from './breakers/DrawdownBreaker';
import { SpreadFilterBreaker } from './breakers/SpreadFilterBreaker';
import { ConsecutiveLossBreaker } from './breakers/ConsecutiveLossBreaker';
import { CircuitBreakerType } from '../../../shared/types/risk';
import { DEFAULT_STRATEGY_CONFIG } from '../../../shared/types/strategy';

/**
 * Global RiskManager singleton
 */
let riskManagerInstance: RiskManager | null = null;

/**
 * Get or create RiskManager singleton
 */
export function getRiskManager(): RiskManager {
  if (!riskManagerInstance) {
    riskManagerInstance = new RiskManager();
    
    // Auto-register default breakers
    const config = DEFAULT_STRATEGY_CONFIG;
    
    riskManagerInstance.registerBreaker(
      new DailyLossBreaker(config.risk.maxDailyLossPercent),
      CircuitBreakerType.DAILY_LOSS
    );
    
    riskManagerInstance.registerBreaker(
      new DrawdownBreaker(config.risk.maxDrawdownPercent),
      CircuitBreakerType.TRAILING_DRAWDOWN
    );
    
    riskManagerInstance.registerBreaker(
      new SpreadFilterBreaker(config.risk.maxSpreadMultiplier),
      CircuitBreakerType.SPREAD_FILTER
    );
    
    riskManagerInstance.registerBreaker(
      new ConsecutiveLossBreaker(config.risk.maxConsecutiveLosses),
      CircuitBreakerType.CONSECUTIVE_LOSSES
    );
    
    console.log('✅ RiskManager initialized with 4 circuit breakers');
  }
  
  return riskManagerInstance;
}

/**
 * Initialize risk manager (call at app startup)
 */
export async function initializeRiskManager(): Promise<RiskManager> {
  const manager = getRiskManager();
  await manager.initialize();
  return manager;
}

// Export classes for custom breaker creation
export { RiskManager, DailyLossBreaker, DrawdownBreaker, SpreadFilterBreaker, ConsecutiveLossBreaker };

// Default export
export const riskManager = getRiskManager();
