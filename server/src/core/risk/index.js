/**
 * Risk Module - JavaScript Bridge
 * 
 * Temporary bridge until full TypeScript migration.
 * This file will be replaced when we compile TypeScript properly.
 */

// Import from correct path (../../../shared from server/src/core/risk)
const getConfig = () => ({
  risk: {
    maxDailyLossPercent: 0.02,
    maxDrawdownPercent: 0.10,
    maxSpreadMultiplier: 1.5,
    maxConsecutiveLosses: 5,
  }
});

/**
 * Simple Circuit Breaker Base Class
 */
class CircuitBreaker {
  constructor(name, enabled = true, requiresManualReset = false) {
    this.name = name;
    this.enabled = enabled;
    this._tripped = false;
    this._lastTripTime = null;
    this.resetRequiresManual = requiresManualReset;
  }
  
  get tripped() {
    return this._tripped;
  }
  
  get lastTripTime() {
    return this._lastTripTime;
  }
  
  trip(reason, metric) {
    this._tripped = true;
    this._lastTripTime = Date.now();
    console.error(`🛑 Circuit Breaker TRIPPED: ${this.name}`);
    console.error(`   Reason: ${reason}`);
    if (metric) {
      console.error(`   Metric: ${metric.name} = ${metric.current}${metric.unit} (threshold: ${metric.threshold}${metric.unit})`);
    }
  }
  
  reset() {
    if (!this.resetRequiresManual || !this._tripped) {
      this._tripped = false;
      this._lastTripTime = null;
    }
  }
  
  forceReset(authorizedBy) {
    console.log(`🔄 Force reset: ${this.name} by ${authorizedBy}`);
    this._tripped = false;
    this._lastTripTime = null;
  }
  
  async check(context) {
    return { allowed: true };
  }
}

/**
 * Mock Circuit Breakers (simplified versions)
 */
class DailyLossBreaker extends CircuitBreaker {
  constructor(maxLossPercent = 0.02) {
    super('Daily Loss Limit', true, true);
    this.maxLossPercent = maxLossPercent;
  }
  
  async check(context) {
    if (!this.enabled || this._tripped) {
      return {
        allowed: !this._tripped,
        reason: this._tripped ? 'Daily loss limit already tripped' : undefined,
      };
    }
    return { allowed: true };
  }
}

class DrawdownBreaker extends CircuitBreaker {
  constructor(maxDrawdownPercent = 0.10) {
    super('Trailing Drawdown Limit', true, true);
    this.maxDrawdownPercent = maxDrawdownPercent;
  }
  
  async check(context) {
    if (!this.enabled || this._tripped) {
      return {
        allowed: !this._tripped,
        reason: this._tripped ? 'Drawdown limit already tripped' : undefined,
      };
    }
    return { allowed: true };
  }
}

class SpreadFilterBreaker extends CircuitBreaker {
  constructor(maxSpreadMultiplier = 1.5) {
    super('Spread Filter', true, false);
    this.maxSpreadMultiplier = maxSpreadMultiplier;
  }
  
  async check(context) {
    if (!this.enabled || this._tripped) {
      return {
        allowed: !this._tripped,
        reason: this._tripped ? 'Spread too wide' : undefined,
      };
    }
    return { allowed: true };
  }
}

class ConsecutiveLossBreaker extends CircuitBreaker {
  constructor(maxConsecutiveLosses = 5) {
    super('Consecutive Loss Limit', true, true);
    this.maxConsecutiveLosses = maxConsecutiveLosses;
    this.consecutiveLosses = 0;
  }
  
  async check(context) {
    if (!this.enabled || this._tripped) {
      return {
        allowed: !this._tripped,
        reason: this._tripped ? `${this.maxConsecutiveLosses} consecutive losses reached` : undefined,
      };
    }
    return { allowed: true };
  }
}

/**
 * Risk Manager
 */
class RiskManager {
  constructor() {
    this.breakers = new Map();
    this.initialized = false;
  }
  
  registerBreaker(breaker, type) {
    this.breakers.set(breaker.name, breaker);
    console.log(`📋 Registered circuit breaker: ${breaker.name}`);
  }
  
  async initialize() {
    console.log('🔧 Initializing Risk Manager...');
    this.initialized = true;
    console.log(`✅ Risk Manager initialized with ${this.breakers.size} breakers`);
  }
  
  async checkAll(context) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    for (const [name, breaker] of this.breakers) {
      if (!breaker.enabled) continue;
      
      try {
        const result = await breaker.check(context);
        
        if (!result.allowed) {
          console.error(`🛑 Action blocked by breaker: ${name}`);
          return result;
        }
      } catch (error) {
        console.error(`❌ Error checking breaker "${name}":`, error);
        return {
          allowed: false,
          reason: `Circuit breaker error: ${name}`,
        };
      }
    }
    
    return { allowed: true };
  }
  
  getStatus() {
    return Array.from(this.breakers.values()).map(breaker => ({
      name: breaker.name,
      type: this.inferType(breaker.name),
      status: {
        tripped: breaker.tripped,
        reason: breaker.tripped ? 'Breaker tripped' : null,
        value: null,
        threshold: null,
      },
    }));
  }
  
  reset(name) {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      throw new Error(`Breaker not found: ${name}`);
    }
    breaker.forceReset('manual');
  }
  
  resetAll() {
    for (const breaker of this.breakers.values()) {
      if (breaker.tripped) {
        breaker.forceReset('manual-reset-all');
      }
    }
  }
  
  getTrippedBreakers() {
    return Array.from(this.breakers.values())
      .filter(b => b.tripped)
      .map(b => b.name);
  }
  
  inferType(name) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('daily') && lowerName.includes('loss')) return 'DAILY_LOSS';
    if (lowerName.includes('drawdown')) return 'TRAILING_DRAWDOWN';
    if (lowerName.includes('consecutive')) return 'CONSECUTIVE_LOSSES';
    if (lowerName.includes('spread')) return 'SPREAD_FILTER';
    return 'DAILY_LOSS';
  }
}

/**
 * Create and initialize singleton
 */
let riskManagerInstance = null;

function getRiskManager() {
  if (!riskManagerInstance) {
    riskManagerInstance = new RiskManager();
    
    // Auto-register breakers
    const config = getConfig();
    
    riskManagerInstance.registerBreaker(
      new DailyLossBreaker(config.risk.maxDailyLossPercent),
      'DAILY_LOSS'
    );
    
    riskManagerInstance.registerBreaker(
      new DrawdownBreaker(config.risk.maxDrawdownPercent),
      'TRAILING_DRAWDOWN'
    );
    
    riskManagerInstance.registerBreaker(
      new SpreadFilterBreaker(config.risk.maxSpreadMultiplier),
      'SPREAD_FILTER'
    );
    
    riskManagerInstance.registerBreaker(
      new ConsecutiveLossBreaker(config.risk.maxConsecutiveLosses),
      'CONSECUTIVE_LOSSES'
    );
  }
  
  return riskManagerInstance;
}

export const riskManager = getRiskManager();
export { RiskManager, DailyLossBreaker, DrawdownBreaker, SpreadFilterBreaker, ConsecutiveLossBreaker };
