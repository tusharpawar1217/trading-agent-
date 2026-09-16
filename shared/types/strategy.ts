/**
 * Strategy Configuration Types
 * 
 * All thresholds, periods, and multipliers are configurable here.
 * No more hard-coded magic numbers!
 */

import { Percentage } from './market';
import { Timeframe } from './market';

export interface StrategyConfig {
  name: string;
  version: string;
  
  indicators: {
    rsi: {
      period: number;
      oversold: number;
      overbought: number;
    };
    macd: {
      fast: number;
      slow: number;
      signal: number;
    };
    sma: {
      short: number;
      long: number;
    };
    ema: {
      fast: number;
      slow: number;
    };
    bollingerBands: {
      period: number;
      stdDev: number;
    };
    atr: {
      period: number;
    };
  };
  
  signals: {
    buyThreshold: number;
    sellThreshold: number;
    confidenceFormula: (score: number) => Percentage;
  };
  
  risk: {
    maxRiskPerTrade: Percentage;        // e.g., 0.01 = 1%
    atrStopMultiplier: number;          // e.g., 1.5-2.0
    defaultRiskReward: number;          // e.g., 2.0
    maxPositions: number;               // e.g., 3
    maxCorrelatedRisk: Percentage;      // e.g., 0.03 = 3%
    maxDailyLoss: Percentage;           // e.g., 0.02 = 2%
    maxDrawdown: Percentage;            // e.g., 0.10 = 10%
  };
  
  timeframes: {
    trend: Timeframe;       // e.g., D1 (daily for directional bias)
    structure: Timeframe;   // e.g., H4 (4-hour for confirmation)
    entry: Timeframe;       // e.g., M15 (15-minute for timing)
  };
}

/**
 * Default strategy configuration
 * Derivation documented inline
 */
export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  name: 'Mean Reversion + Trend Filter',
  version: '1.0.0',
  
  indicators: {
    rsi: {
      period: 14,       // Standard Wilder's RSI
      oversold: 30,     // Traditional oversold threshold
      overbought: 70,   // Traditional overbought threshold
    },
    macd: {
      fast: 12,         // Standard fast EMA
      slow: 26,         // Standard slow EMA
      signal: 9,        // Standard signal line
    },
    sma: {
      short: 20,        // Short-term trend (1 month on daily)
      long: 50,         // Long-term trend (2.5 months on daily)
    },
    ema: {
      fast: 12,         // Aligns with MACD fast
      slow: 26,         // Aligns with MACD slow
    },
    bollingerBands: {
      period: 20,       // Standard BB period
      stdDev: 2,        // Standard deviation (95% of data)
    },
    atr: {
      period: 14,       // Standard ATR period
    },
  },
  
  signals: {
    buyThreshold: 2,    // Requires 2+ aligned bullish rules
    sellThreshold: -2,  // Requires 2+ aligned bearish rules
    confidenceFormula: (score: number) => {
      // Max score is ±4 (all rules aligned)
      // Confidence = (|score| / 4) * 100, capped at 100%
      return Math.min(100, (Math.abs(score) / 4) * 100) as Percentage;
    },
  },
  
  risk: {
    // Risk 1% of account per trade
    // Derivation: Kelly Criterion suggests 1-2% for 55% win rate
    maxRiskPerTrade: 0.01 as Percentage,
    
    // Stop loss = 1.5× ATR
    // Derivation: Tighter (1.0×) gets stopped out too often
    //             Wider (2.5×) gives up too much on losers
    atrStopMultiplier: 1.5,
    
    // Target 2:1 reward:risk
    // Derivation: With 55% win rate, 2:1 R:R gives positive expectancy
    //             Expectancy = (0.55 × 2) - (0.45 × 1) = 0.65R per trade
    defaultRiskReward: 2.0,
    
    // Max 3 concurrent positions
    // Derivation: Limits total exposure to 3% of account
    maxPositions: 3,
    
    // Max 3% correlated risk (e.g., don't stack EUR/USD + GBP/USD longs)
    // Derivation: Major pairs often 70-85% correlated during USD moves
    maxCorrelatedRisk: 0.03 as Percentage,
    
    // Halt trading after -2% daily loss
    // Derivation: Preserves 98% of capital for next day
    //             Multiple -2% days trigger review, not blowup
    maxDailyLoss: 0.02 as Percentage,
    
    // Halt trading after -10% drawdown from peak
    // Derivation: Professional prop firms typically cut off at 8-10%
    maxDrawdown: 0.10 as Percentage,
  },
  
  timeframes: {
    trend: Timeframe.D1,       // Daily chart for overall bias
    structure: Timeframe.H4,   // 4-hour for swing structure
    entry: Timeframe.M15,      // 15-minute for entry timing
  },
};
