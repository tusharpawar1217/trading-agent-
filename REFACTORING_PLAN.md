# FX DESK - COMPREHENSIVE REFACTORING PLAN

**Goal:** Transform prototype into production-ready trading system with deterministic architecture, TypeScript safety, and multi-timeframe support.

---

## **OVERVIEW**

### **Current State**
- ❌ UI-coupled calculation logic
- ❌ Hard-coded thresholds everywhere
- ❌ No risk management (circuit breakers, margin checks, spread filters)
- ❌ Race conditions in price updates
- ❌ Single timeframe (daily only)
- ❌ No staleness detection
- ✅ 45 passing unit tests (good foundation)

### **Target State**
- ✅ Three-layer headless architecture
- ✅ TypeScript with branded types (Price, Pips, Percentage)
- ✅ Configurable strategy parameters
- ✅ Multi-timeframe support (1s to 1D)
- ✅ Circuit breakers & risk filters
- ✅ Bar chart visualization
- ✅ Live broker interface (OANDA/MT5 ready)

---

## **PHASE 1: TypeScript Migration Strategy**

### **1.1 Migration Approach**
**Strategy:** Incremental migration (not "rewrite everything")

**Order of conversion:**
```
1. Core types & interfaces (NEW files)
2. Utility functions (indicators, calculations)
3. Services (API, trading, storage)
4. Backend routes
5. React components (last)
```

**Why this order?**
- Start with zero dependencies (types)
- Move up dependency tree
- UI components have most dependencies → convert last

### **1.2 File-by-File TypeScript Migration**

#### **Step 1: Create Core Types** (NEW FILES)

**File:** `shared/types/market.ts`
```typescript
// Branded types prevent mixing incompatible values
export type Price = number & { readonly __brand: 'Price' };
export type Pips = number & { readonly __brand: 'Pips' };
export type Percentage = number & { readonly __brand: 'Percentage' };
export type Timestamp = number & { readonly __brand: 'Timestamp' };

export enum Timeframe {
  S1 = '1s',    // 1 second
  S5 = '5s',
  S15 = '15s',
  S30 = '30s',
  M1 = '1m',    // 1 minute
  M5 = '5m',
  M15 = '15m',
  M30 = '30m',
  H1 = '1h',    // 1 hour
  H4 = '4h',
  D1 = '1d',    // 1 day
  W1 = '1w',    // 1 week
}

export interface OHLC {
  timestamp: Timestamp;
  open: Price;
  high: Price;
  low: Price;
  close: Price;
  volume?: number;
}

export interface CurrencyPair {
  symbol: string; // e.g., "EUR/USD"
  base: string;   // e.g., "EUR"
  quote: string;  // e.g., "USD"
  pipValue: Pips; // e.g., 0.0001 for most pairs, 0.01 for JPY pairs
}

export interface Quote {
  pair: CurrencyPair;
  bid: Price;
  ask: Price;
  spread: Pips;
  timestamp: Timestamp;
}
```

**File:** `shared/types/strategy.ts`
```typescript
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
    atrStopMultiplier: number;          // e.g., 1.5
    defaultRiskReward: number;          // e.g., 2.0
    maxPositions: number;               // e.g., 3
    maxCorrelatedRisk: Percentage;      // e.g., 0.03 = 3%
  };
  
  timeframes: {
    trend: Timeframe;       // e.g., D1 (daily for bias)
    structure: Timeframe;   // e.g., H4 (4-hour for confirmation)
    entry: Timeframe;       // e.g., M15 (15-minute for timing)
  };
}

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  name: 'Mean Reversion + Trend Filter',
  version: '1.0.0',
  
  indicators: {
    rsi: { period: 14, oversold: 30, overbought: 70 },
    macd: { fast: 12, slow: 26, signal: 9 },
    sma: { short: 20, long: 50 },
    ema: { fast: 12, slow: 26 },
    bollingerBands: { period: 20, stdDev: 2 },
    atr: { period: 14 },
  },
  
  signals: {
    buyThreshold: 2,
    sellThreshold: -2,
    confidenceFormula: (score) => Math.min(100, Math.abs(score) / 4 * 100) as Percentage,
  },
  
  risk: {
    maxRiskPerTrade: 0.01 as Percentage,
    atrStopMultiplier: 1.5,
    defaultRiskReward: 2.0,
    maxPositions: 3,
    maxCorrelatedRisk: 0.03 as Percentage,
  },
  
  timeframes: {
    trend: Timeframe.D1,
    structure: Timeframe.H4,
    entry: Timeframe.M15,
  },
};
```

**File:** `shared/types/trading.ts`
```typescript
import { Price, Pips, Percentage, Timestamp } from './market';
import { CurrencyPair } from './market';

export enum OrderDirection {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  PENDING = 'pending',
  OPEN = 'open',
  CLOSED = 'closed',
  REJECTED = 'rejected',
}

export interface Position {
  id: string;
  pair: CurrencyPair;
  direction: OrderDirection;
  
  entryPrice: Price;
  stopLoss: Price;
  takeProfit: Price;
  size: number; // units
  
  entryTime: Timestamp;
  exitTime?: Timestamp;
  exitPrice?: Price;
  
  status: OrderStatus;
  closeReason?: 'stop_loss' | 'take_profit' | 'manual' | 'circuit_breaker';
  
  risk: {
    pips: Pips;
    amount: number; // in account currency
  };
  
  reward: {
    pips: Pips;
    amount: number;
  };
  
  riskRewardRatio: number;
  
  pnl: {
    unrealized: number | null;
    realized: number | null;
    pips: Pips;
  };
  
  signal?: Signal; // Original signal that generated this position
  notes?: string;
}

export interface Signal {
  id: string;
  pair: CurrencyPair;
  verdict: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  confidence: Percentage;
  
  reasons: SignalReason[];
  
  timestamp: Timestamp;
  
  marketData: {
    currentPrice: Price;
    rsi: number;
    macdHistogram: number;
    sma50: Price;
    atr: Pips;
    bollingerBands: {
      upper: Price;
      middle: Price;
      lower: Price;
    };
  };
  
  suggestedLevels?: {
    entry: Price;
    stopLoss: Price;
    takeProfit: Price;
    riskRewardRatio: number;
    riskPips: Pips;
    rewardPips: Pips;
  };
}

export interface SignalReason {
  rule: string;
  condition: string;
  value: string;
  score: 1 | -1;
  interpretation: string;
}
```

**File:** `shared/types/risk.ts`
```typescript
export interface CircuitBreaker {
  name: string;
  enabled: boolean;
  tripped: boolean;
  lastTripTime?: Timestamp;
  resetRequiresManual: boolean;
  check(): Promise<CircuitBreakerResult>;
  reset(): void;
}

export interface CircuitBreakerResult {
  allowed: boolean;
  reason?: string;
  metric?: {
    name: string;
    current: number;
    threshold: number;
    unit: string;
  };
}

export enum CircuitBreakerType {
  DAILY_LOSS = 'daily_loss',
  TRAILING_DRAWDOWN = 'trailing_drawdown',
  CONSECUTIVE_LOSSES = 'consecutive_losses',
  SPREAD_FILTER = 'spread_filter',
  NEWS_EMBARGO = 'news_embargo',
  MAX_POSITIONS = 'max_positions',
}
```

#### **Step 2: Convert Utilities to TypeScript**

**File:** `server/src/utils/indicators.ts` (rename from `.js`)

**Changes:**
```typescript
import { Price, OHLC } from '../../../shared/types/market';

export function calculateSMA(data: Price[], period: number): (Price | null)[] {
  if (!data || data.length === 0) return [];
  if (period <= 0) throw new Error('Period must be positive');
  
  const result: (Price | null)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push((sum / period) as Price);
    }
  }
  
  return result;
}

// Add NEW indicator: ATR (Average True Range)
export function calculateATR(candles: OHLC[], period: number = 14): (Pips | null)[] {
  if (!candles || candles.length < 2) return [];
  
  const trueRanges: Pips[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    ) as Pips;
    
    trueRanges.push(tr);
  }
  
  // Calculate EMA of true ranges
  const atrValues: (Pips | null)[] = [null]; // First candle has no ATR
  
  if (trueRanges.length >= period) {
    let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
    atrValues.push(atr as Pips);
    
    for (let i = period; i < trueRanges.length; i++) {
      atr = (atr * (period - 1) + trueRanges[i]) / period;
      atrValues.push(atr as Pips);
    }
  }
  
  return atrValues;
}
```

**File:** `server/src/utils/calculations.ts` (NEW)
```typescript
import { Price, Pips, Percentage } from '../../../shared/types/market';
import { OrderDirection } from '../../../shared/types/trading';

/**
 * Convert price difference to pips
 * @param priceDiff - Difference in price
 * @param pipValue - Pip value for the pair (0.0001 for most, 0.01 for JPY)
 */
export function priceToPips(priceDiff: number, pipValue: Pips): Pips {
  return (priceDiff / pipValue) as Pips;
}

/**
 * Convert pips to price difference
 */
export function pipsToPrice(pips: Pips, pipValue: Pips): number {
  return pips * pipValue;
}

/**
 * Calculate ATR-based stop loss
 * @param entryPrice - Entry price
 * @param direction - BUY or SELL
 * @param atr - Current ATR value
 * @param multiplier - ATR multiplier (1.5-2.0 typical)
 */
export function calculateATRStopLoss(
  entryPrice: Price,
  direction: OrderDirection,
  atr: Pips,
  multiplier: number,
  pipValue: Pips
): Price {
  const stopDistance = pipsToPrice(atr * multiplier as Pips, pipValue);
  
  if (direction === OrderDirection.BUY) {
    return (entryPrice - stopDistance) as Price;
  } else {
    return (entryPrice + stopDistance) as Price;
  }
}

/**
 * Calculate position size based on risk
 * Formula: size = (equity × risk_pct) / (ATR × atr_multiplier × pip_value × contract_size)
 * 
 * @param equity - Account equity
 * @param riskPct - Max risk per trade (e.g., 0.01 = 1%)
 * @param atr - Current ATR value
 * @param atrMultiplier - Stop loss multiplier
 * @param pipValue - Pip value for pair
 * @param contractSize - Standard contract size (100,000 for standard lot)
 */
export function calculatePositionSize(
  equity: number,
  riskPct: Percentage,
  atr: Pips,
  atrMultiplier: number,
  pipValue: Pips,
  contractSize: number = 100000
): number {
  const riskAmount = equity * riskPct;
  const stopLossPips = atr * atrMultiplier;
  const stopLossValue = stopLossPips * pipValue * contractSize;
  
  const positionSize = riskAmount / stopLossValue;
  
  // Round to nearest 0.01 lot
  return Math.round(positionSize * 100) / 100;
}
```

#### **Step 3: Create Broker Interface**

**File:** `server/src/core/broker/IBrokerClient.ts` (NEW)
```typescript
import { Quote, CurrencyPair, Timestamp } from '../../../../shared/types/market';
import { Position, OrderDirection } from '../../../../shared/types/trading';

export interface AccountInfo {
  equity: number;
  balance: number;
  marginUsed: number;
  marginAvailable: number;
  currency: string;
  leverage: number;
  timestamp: Timestamp;
}

export interface OrderRequest {
  pair: CurrencyPair;
  direction: OrderDirection;
  size: number; // in lots
  stopLoss: Price;
  takeProfit: Price;
  notes?: string;
}

export interface OrderResponse {
  orderId: string;
  status: 'filled' | 'rejected' | 'pending';
  fillPrice?: Price;
  fillTime?: Timestamp;
  rejectionReason?: string;
  commission?: number;
  slippage?: Pips;
}

export interface IBrokerClient {
  /**
   * Get current quote for a currency pair
   */
  getQuote(pair: CurrencyPair): Promise<Quote>;
  
  /**
   * Get account information
   */
  getAccount(): Promise<AccountInfo>;
  
  /**
   * Place market order
   */
  placeOrder(order: OrderRequest): Promise<OrderResponse>;
  
  /**
   * Get all open positions
   */
  getOpenPositions(): Promise<Position[]>;
  
  /**
   * Close a position
   */
  closePosition(positionId: string): Promise<OrderResponse>;
  
  /**
   * Stream real-time prices (optional, may fall back to polling)
   */
  streamPrices(pairs: CurrencyPair[], onTick: (quote: Quote) => void): () => void;
  
  /**
   * Check if broker connection is healthy
   */
  healthCheck(): Promise<boolean>;
}
```

### **1.3 TypeScript Configuration**

**File:** `tsconfig.json` (ROOT)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false,
    "outDir": "./dist",
    "rootDir": "./",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["shared/*"],
      "@server/*": ["server/src/*"],
      "@client/*": ["client/src/*"]
    }
  },
  "include": ["server/src/**/*", "shared/**/*"],
  "exclude": ["node_modules", "dist", "client"]
}
```

**File:** `client/tsconfig.json`
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": true
  },
  "include": ["src", "../shared"],
  "references": [{ "path": "../tsconfig.json" }]
}
```

---

## **PHASE 2: Three-Layer Architecture**

### **2.1 Architecture Overview**

```
┌─────────────────────────────────────────────────────────────┐
│                         UI LAYER                            │
│  React Components (Tab Navigation, Charts, Signals, etc.)   │
│              ↓ calls ↓                                      │
│         UI Adapters/Hooks                                   │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                     │
│                    (HEADLESS ENGINE)                        │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │   Strategy    │  │  Risk Mgmt   │  │   Position      │ │
│  │   Engine      │  │  & Circuit   │  │   Manager       │ │
│  │               │  │  Breakers    │  │                 │ │
│  └───────────────┘  └──────────────┘  └─────────────────┘ │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │         AI Market Intelligence (LLM)                  │ │
│  │         - Returns ONLY advisory text                  │ │
│  │         - Cannot return trade instructions            │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   EXECUTION LAYER                           │
│  ┌─────────────────┐              ┌────────────────────┐   │
│  │  PaperBroker    │              │  LiveBroker        │   │
│  │  - Simulates    │              │  - OANDA v20       │   │
│  │    realistic    │              │  - MT5 (future)    │   │
│  │    fills        │              │  - Armed flag req  │   │
│  │  - Slippage     │              │  - Credentials req │   │
│  │  - Commissions  │              │                    │   │
│  └─────────────────┘              └────────────────────┘   │
│              ↓                              ↓               │
│     Simulated Market Data          Real Market Data        │
└─────────────────────────────────────────────────────────────┘
```

### **2.2 Layer Boundaries (Enforced by Types)**

**Rule:** Lower layers NEVER import from upper layers

```typescript
// ✅ ALLOWED
import { calculateSMA } from '@server/core/indicators';  // Business → Utility
import { PaperBroker } from '@server/core/broker';      // Business → Execution

// ❌ FORBIDDEN (enforced by linter)
import { SignalCard } from '@client/components';        // Business → UI (NO!)
import React from 'react';                              // Execution → UI (NO!)
```

**ESLint Rule:** `import/no-restricted-paths`

### **2.3 Directory Structure**

```
fx-desk/
├── shared/                    # Shared types (isomorphic)
│   └── types/
│       ├── market.ts         # OHLC, Price, Pips, Timeframe
│       ├── trading.ts        # Position, Signal, Order
│       ├── strategy.ts       # StrategyConfig
│       └── risk.ts           # CircuitBreaker types
│
├── server/
│   └── src/
│       ├── core/                      # BUSINESS LOGIC (headless)
│       │   ├── strategy/
│       │   │   ├── StrategyEngine.ts         # Main entry point
│       │   │   ├── indicators.ts             # All technical indicators
│       │   │   ├── signalScorer.ts           # Rule-based scoring
│       │   │   ├── multiTimeframe.ts         # MTF analysis
│       │   │   └── positionSizer.ts          # ATR-based sizing
│       │   │
│       │   ├── risk/
│       │   │   ├── RiskManager.ts            # Orchestrates breakers
│       │   │   ├── CircuitBreaker.ts         # Base class
│       │   │   ├── breakers/
│       │   │   │   ├── DailyLossBreaker.ts
│       │   │   │   ├── DrawdownBreaker.ts
│       │   │   │   ├── SpreadFilterBreaker.ts
│       │   │   │   ├── NewsEmbargoBreaker.ts
│       │   │   │   └── ConsecutiveLossBreaker.ts
│       │   │   └── exposureCalculator.ts     # Correlation checks
│       │   │
│       │   ├── broker/
│       │   │   ├── IBrokerClient.ts          # Interface
│       │   │   ├── PaperBroker.ts            # Simulated execution
│       │   │   ├── OANDABroker.ts            # Live (OANDA v20)
│       │   │   └── BrokerFactory.ts          # Returns correct impl
│       │   │
│       │   ├── intelligence/
│       │   │   ├── LLMService.ts             # Gemini integration
│       │   │   └── llmTypes.ts               # Return types (NO orders!)
│       │   │
│       │   └── position/
│       │       ├── PositionManager.ts        # CRUD + P&L tracking
│       │       └── tradeJournal.ts           # Logging & analytics
│       │
│       ├── services/                    # API layer (calls core)
│       │   ├── marketData.ts
│       │   └── priceStream.ts           # WebSocket for real-time
│       │
│       ├── routes/                      # Express routes
│       │   ├── signals.ts
│       │   ├── positions.ts
│       │   ├── risk.ts                  # Breaker status/reset
│       │   └── analytics.ts             # Stats endpoints
│       │
│       └── index.ts
│
├── client/
│   └── src/
│       ├── adapters/                    # Bridge UI → Core
│       │   ├── useStrategyEngine.ts     # Hook wrapping core
│       │   ├── useBrokerStatus.ts
│       │   └── useRiskManager.ts
│       │
│       ├── components/
│       │   ├── charts/
│       │   │   ├── CandlestickChart.tsx      # NEW: Bar chart
│       │   │   ├── TimeframeSelector.tsx     # NEW: 1s to 1D
│       │   │   └── SignalOverlay.tsx         # Markers on chart
│       │   │
│       │   ├── trading/
│       │   │   ├── SignalCard.tsx
│       │   │   ├── SignalApproval.tsx        # With adjustable sliders
│       │   │   └── PositionsList.tsx
│       │   │
│       │   ├── risk/
│       │   │   ├── CircuitBreakerDashboard.tsx
│       │   │   └── PromotionGate.tsx         # Paper → Live checklist
│       │   │
│       │   └── analytics/
│       │       └── TradingMetrics.tsx        # Sharpe, expectancy, etc.
│       │
│       └── services/
│           ├── api.ts                   # Fetch wrappers
│           └── storageService.ts
│
└── tests/
    ├── unit/                            # Core logic tests
    │   ├── indicators.test.ts
    │   ├── signalScorer.test.ts
    │   ├── circuitBreakers.test.ts
    │   └── positionSizer.test.ts
    │
    └── integration/                     # End-to-end
        ├── paperTrading.test.ts
        └── multiTimeframe.test.ts
```

---

## **PHASE 3: Circuit Breaker Architecture**

### **3.1 Base Circuit Breaker Class**

**File:** `server/src/core/risk/CircuitBreaker.ts`
```typescript
import { CircuitBreakerResult, Timestamp } from '@shared/types/risk';

export abstract class CircuitBreaker {
  protected _tripped: boolean = false;
  protected _lastTripTime?: Timestamp;
  
  constructor(
    public readonly name: string,
    public enabled: boolean = true,
    public readonly resetRequiresManual: boolean = true
  ) {}
  
  get tripped(): boolean {
    return this._tripped;
  }
  
  /**
   * Check if this breaker allows the action
   * Returns { allowed: true } or { allowed: false, reason: '...' }
   */
  abstract check(): Promise<CircuitBreakerResult>;
  
  /**
   * Trip the breaker (called internally or by RiskManager)
   */
  protected trip(reason: string, metric?: any): void {
    this._tripped = true;
    this._lastTripTime = Date.now() as Timestamp;
    
    // Log to monitoring system
    console.error(`🚨 CIRCUIT BREAKER TRIPPED: ${this.name}`);
    console.error(`   Reason: ${reason}`);
    if (metric) {
      console.error(`   Metric: ${JSON.stringify(metric)}`);
    }
    
    // TODO: Send alert (email, SMS, Slack, etc.)
  }
  
  /**
   * Reset the breaker (only if manual reset not required)
   */
  reset(): void {
    if (this.resetRequiresManual) {
      console.warn(`⚠️  Breaker "${this.name}" requires manual reset via API`);
      return;
    }
    
    this._tripped = false;
    console.log(`✅ Circuit breaker reset: ${this.name}`);
  }
  
  /**
   * Force reset (for manual intervention)
   */
  forceReset(authorizedBy: string): void {
    this._tripped = false;
    console.log(`✅ Circuit breaker FORCE RESET by ${authorizedBy}: ${this.name}`);
  }
}
```

### **3.2 Concrete Circuit Breakers**

**File:** `server/src/core/risk/breakers/DailyLossBreaker.ts`
```typescript
import { CircuitBreaker } from '../CircuitBreaker';
import { CircuitBreakerResult, Percentage } from '@shared/types/risk';

export class DailyLossBreaker extends CircuitBreaker {
  private startOfDayEquity: number = 0;
  
  constructor(
    private getCurrentEquity: () => Promise<number>,
    private maxDailyLoss: Percentage = 0.02 as Percentage, // 2%
  ) {
    super('Daily Loss Limit', true, true);
  }
  
  async initialize(): Promise<void> {
    this.startOfDayEquity = await this.getCurrentEquity();
  }
  
  async check(): Promise<CircuitBreakerResult> {
    if (!this.enabled) {
      return { allowed: true };
    }
    
    if (this._tripped) {
      return {
        allowed: false,
        reason: `Daily loss limit breaker already tripped at ${new Date(this._lastTripTime!).toISOString()}`,
      };
    }
    
    const currentEquity = await this.getCurrentEquity();
    const lossAmount = this.startOfDayEquity - currentEquity;
    const lossPct = lossAmount / this.startOfDayEquity;
    
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
        reason: `Daily loss limit exceeded: -${(lossPct * 100).toFixed(2)}%`,
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
}
```

**File:** `server/src/core/risk/breakers/SpreadFilterBreaker.ts`
```typescript
import { CircuitBreaker } from '../CircuitBreaker';
import { CircuitBreakerResult, Pips, Quote } from '@shared/types';

export class SpreadFilterBreaker extends CircuitBreaker {
  private spreadHistory: Map<string, Pips[]> = new Map();
  private readonly historySize = 20;
  
  constructor(
    private getQuote: (pair: string) => Promise<Quote>,
    private maxSpreadMultiplier: number = 1.5,
  ) {
    super('Spread Filter', true, false); // Auto-reset when spread normalizes
  }
  
  async check(pair: string): Promise<CircuitBreakerResult> {
    if (!this.enabled) {
      return { allowed: true };
    }
    
    const quote = await this.getQuote(pair);
    const currentSpread = quote.spread;
    
    // Get spread history
    if (!this.spreadHistory.has(pair)) {
      this.spreadHistory.set(pair, []);
    }
    
    const history = this.spreadHistory.get(pair)!;
    history.push(currentSpread);
    
    if (history.length > this.historySize) {
      history.shift();
    }
    
    // Need at least 10 samples to calculate average
    if (history.length < 10) {
      return { allowed: true }; // Not enough data yet
    }
    
    const avgSpread = history.reduce((a, b) => a + b, 0) / history.length as Pips;
    const threshold = avgSpread * this.maxSpreadMultiplier as Pips;
    
    if (currentSpread > threshold) {
      return {
        allowed: false,
        reason: `Spread too wide: ${currentSpread.toFixed(1)} pips (avg: ${avgSpread.toFixed(1)})`,
        metric: {
          name: 'Spread',
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
}
```

### **3.3 Risk Manager Orchestrator**

**File:** `server/src/core/risk/RiskManager.ts`
```typescript
import { CircuitBreaker } from './CircuitBreaker';
import { CircuitBreakerResult } from '@shared/types/risk';

export class RiskManager {
  private breakers: Map<string, CircuitBreaker> = new Map();
  
  registerBreaker(breaker: CircuitBreaker): void {
    this.breakers.set(breaker.name, breaker);
  }
  
  /**
   * Check ALL breakers before allowing action
   * Returns first failure, or success if all pass
   */
  async checkAll(context?: any): Promise<CircuitBreakerResult> {
    for (const [name, breaker] of this.breakers) {
      if (!breaker.enabled) continue;
      
      const result = await breaker.check(context);
      
      if (!result.allowed) {
        return result; // Stop at first failure
      }
    }
    
    return { allowed: true };
  }
  
  /**
   * Get status of all breakers
   */
  getStatus(): Array<{
    name: string;
    enabled: boolean;
    tripped: boolean;
    requiresManualReset: boolean;
  }> {
    return Array.from(this.breakers.values()).map(breaker => ({
      name: breaker.name,
      enabled: breaker.enabled,
      tripped: breaker.tripped,
      requiresManualReset: breaker.resetRequiresManual,
    }));
  }
  
  /**
   * Manually reset a breaker
   */
  resetBreaker(name: string, authorizedBy: string): void {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      throw new Error(`Breaker not found: ${name}`);
    }
    
    breaker.forceReset(authorizedBy);
  }
}
```

---

## **PHASE 4: Multi-Timeframe Support**

### **4.1 Timeframe Configuration**

**Supported Timeframes:**
```typescript
enum Timeframe {
  S1 = '1s',    S5 = '5s',   S15 = '15s',  S30 = '30s',
  M1 = '1m',    M5 = '5m',   M15 = '15m',  M30 = '30m',
  H1 = '1h',    H4 = '4h',   H8 = '8h',
  D1 = '1d',    W1 = '1w',   MN = '1M',
}
```

### **4.2 Multi-Timeframe Analysis**

**File:** `server/src/core/strategy/multiTimeframe.ts`
```typescript
import { OHLC, Timeframe } from '@shared/types/market';
import { calculateSMA } from './indicators';

export interface MultiTimeframeContext {
  trend: {
    timeframe: Timeframe;
    data: OHLC[];
    bias: 'bullish' | 'bearish' | 'neutral';
    strength: number; // 0-100
  };
  structure: {
    timeframe: Timeframe;
    data: OHLC[];
    support: Price[];
    resistance: Price[];
  };
  entry: {
    timeframe: Timeframe;
    data: OHLC[];
  };
}

/**
 * Multi-timeframe trend alignment
 * 
 * Rule: Signal only fires when timeframes agree on direction
 * 
 * Example:
 *   Daily (D1):  Price > SMA(50) → Bullish bias
 *   4-Hour (H4): Price > SMA(20) → Bullish confirmation
 *   15-Min (M15): RSI < 30 → Oversold entry (BUY setup)
 * 
 * Result: BUY signal fires ONLY if D1 and H4 are both bullish
 */
export function checkMultiTimeframeAlignment(
  mtfContext: MultiTimeframeContext
): {
  aligned: boolean;
  direction: 'BUY' | 'SELL' | null;
  reason: string;
} {
  const { trend, structure, entry } = mtfContext;
  
  // Check trend timeframe bias
  const trendBias = trend.bias;
  
  if (trendBias === 'neutral') {
    return {
      aligned: false,
      direction: null,
      reason: 'Higher timeframe (trend) is neutral - no directional bias',
    };
  }
  
  // Check structure timeframe alignment
  const structureData = structure.data;
  const structureClose = structureData[structureData.length - 1].close;
  const structureSMA = calculateSMA(
    structureData.map(c => c.close),
    20
  );
  const structureBias = structureClose > structureSMA[structureSMA.length - 1]!
    ? 'bullish'
    : 'bearish';
  
  // Timeframes must agree
  if (
    (trendBias === 'bullish' && structureBias === 'bearish') ||
    (trendBias === 'bearish' && structureBias === 'bullish')
  ) {
    return {
      aligned: false,
      direction: null,
      reason: `Timeframe conflict: Trend is ${trendBias} but structure is ${structureBias}`,
    };
  }
  
  // Aligned - return direction
  const direction = trendBias === 'bullish' ? 'BUY' : 'SELL';
  
  return {
    aligned: true,
    direction,
    reason: `All timeframes aligned ${direction}: Trend=${trendBias}, Structure=${structureBias}`,
  };
}
```

### **4.3 Data Aggregation (Timeframe Conversion)**

**File:** `server/src/core/strategy/timeframeConverter.ts`
```typescript
/**
 * Convert lower timeframe data to higher timeframe
 * Example: 1-minute candles → 5-minute candles
 */
export function aggregateTimeframe(
  candles: OHLC[],
  fromTimeframe: Timeframe,
  toTimeframe: Timeframe
): OHLC[] {
  const ratio = getTimeframeRatio(fromTimeframe, toTimeframe);
  
  if (ratio < 1) {
    throw new Error(`Cannot aggregate to lower timeframe: ${fromTimeframe} → ${toTimeframe}`);
  }
  
  const aggregated: OHLC[] = [];
  
  for (let i = 0; i < candles.length; i += ratio) {
    const chunk = candles.slice(i, i + ratio);
    
    if (chunk.length === 0) break;
    
    aggregated.push({
      timestamp: chunk[0].timestamp,
      open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)) as Price,
      low: Math.min(...chunk.map(c => c.low)) as Price,
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + (c.volume || 0), 0),
    });
  }
  
  return aggregated;
}

function getTimeframeRatio(from: Timeframe, to: Timeframe): number {
  const seconds: Record<Timeframe, number> = {
    [Timeframe.S1]: 1,
    [Timeframe.S5]: 5,
    [Timeframe.S15]: 15,
    [Timeframe.S30]: 30,
    [Timeframe.M1]: 60,
    [Timeframe.M5]: 300,
    [Timeframe.M15]: 900,
    [Timeframe.M30]: 1800,
    [Timeframe.H1]: 3600,
    [Timeframe.H4]: 14400,
    [Timeframe.D1]: 86400,
    [Timeframe.W1]: 604800,
  };
  
  return seconds[to] / seconds[from];
}
```

---

## **PHASE 5: Bar Chart with Multiple Timeframes**

### **5.1 Chart Component**

**File:** `client/src/components/charts/CandlestickChart.tsx` (NEW)
```typescript
import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import 'chartjs-adapter-date-fns';
import { Timeframe } from '@shared/types/market';

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  CandlestickController,
  CandlestickElement
);

interface CandlestickChartProps {
  data: OHLC[];
  timeframe: Timeframe;
  signals?: Signal[];
  indicators?: {
    sma20?: number[];
    bollingerUpper?: number[];
    bollingerLower?: number[];
  };
}

export function CandlestickChart({ data, timeframe, signals, indicators }: CandlestickChartProps) {
  const chartData = useMemo(() => {
    return {
      datasets: [
        {
          label: 'Price',
          type: 'candlestick',
          data: data.map(candle => ({
            x: candle.timestamp,
            o: candle.open,
            h: candle.high,
            l: candle.low,
            c: candle.close,
          })),
        },
        indicators?.sma20 && {
          label: 'SMA(20)',
          type: 'line',
          data: indicators.sma20.map((value, i) => ({
            x: data[i].timestamp,
            y: value,
          })),
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2,
          pointRadius: 0,
        },
        // Bollinger bands...
      ].filter(Boolean),
    };
  }, [data, indicators]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        time: {
          unit: getTimeUnit(timeframe),
        },
      },
      y: {
        position: 'right',
      },
    },
    plugins: {
      legend: {
        display: true,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
  };

  return (
    <div style={{ height: '500px', position: 'relative' }}>
      <Chart type="candlestick" data={chartData} options={options} />
      {/* Signal overlay markers */}
      {signals?.map(signal => (
        <SignalMarker key={signal.id} signal={signal} />
      ))}
    </div>
  );
}

function getTimeUnit(timeframe: Timeframe): string {
  if (timeframe.includes('s')) return 'second';
  if (timeframe.includes('m')) return 'minute';
  if (timeframe.includes('h')) return 'hour';
  if (timeframe.includes('d')) return 'day';
  return 'hour';
}
```

**File:** `client/src/components/charts/TimeframeSelector.tsx` (NEW)
```typescript
import { Timeframe } from '@shared/types/market';

const TIMEFRAME_GROUPS = {
  Seconds: [Timeframe.S1, Timeframe.S5, Timeframe.S15, Timeframe.S30],
  Minutes: [Timeframe.M1, Timeframe.M5, Timeframe.M15, Timeframe.M30],
  Hours: [Timeframe.H1, Timeframe.H4],
  Days: [Timeframe.D1, Timeframe.W1],
};

interface TimeframeSelectorProps {
  selected: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export function TimeframeSelector({ selected, onChange }: TimeframeSelectorProps) {
  return (
    <div className="flex gap-2">
      {Object.entries(TIMEFRAME_GROUPS).map(([group, timeframes]) => (
        <div key={group} className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">{group}</span>
          <div className="flex gap-1">
            {timeframes.map(tf => (
              <button
                key={tf}
                className={`btn ${selected === tf ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onChange(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## **PHASE 6: Implementation Order**

### **Week 1: Foundation**
1. ✅ Create API key configuration (Gemini)
2. Create TypeScript types (`shared/types/`)
3. Setup `tsconfig.json` and build process
4. Convert `indicators.js` → `indicators.ts`
5. Add ATR calculation + tests

### **Week 2: Core Business Logic**
6. Create `StrategyEngine.ts` (headless)
7. Implement `PositionSizer.ts` (ATR-based)
8. Create `IBrokerClient.ts` interface
9. Implement `PaperBroker.ts` with realistic fills
10. Add unit tests for all core logic

### **Week 3: Risk Management**
11. Create `CircuitBreaker.ts` base class
12. Implement all 5 breakers (Daily Loss, Drawdown, Spread, News, Consecutive)
13. Create `RiskManager.ts` orchestrator
14. Add breaker status API endpoints
15. Test breaker trip/reset flows

### **Week 4: Multi-Timeframe**
16. Implement `timeframeConverter.ts`
17. Create `multiTimeframe.ts` alignment logic
18. Update market data service for multiple timeframes
19. Add MTF tests

### **Week 5: UI Updates**
20. Install `chartjs-chart-financial`
21. Create `CandlestickChart.tsx`
22. Create `TimeframeSelector.tsx`
23. Add signal overlay markers
24. Create `CircuitBreakerDashboard.tsx`
25. Create `PromotionGate.tsx` (paper → live checklist)

### **Week 6: Integration & Testing**
26. Wire up headless engine to UI via hooks
27. End-to-end testing (paper trading flow)
28. Performance testing (indicator calculations)
29. Documentation updates
30. Final review before live broker stub

---

## **DELIVERABLES**

### **Code**
- ✅ Gemini API key configured
- 📦 TypeScript migration (80% complete)
- 📦 Three-layer architecture
- 📦 Circuit breakers (5 types)
- 📦 Multi-timeframe support (1s to 1W)
- 📦 Bar chart component
- 📦 100+ unit tests

### **Documentation**
- Architecture diagrams
- API documentation (Swagger/OpenAPI)
- Circuit breaker operation manual
- Strategy configuration guide
- Migration guide (old code → new code)

### **Safety**
- ✅ LLM cannot return trade instructions
- ✅ All risk filters in place
- ✅ Live broker requires manual arming
- ✅ Circuit breakers trip automatically
- ✅ Position sizing based on ATR, not guesses

---

## **TERMINAL COMMANDS**

### **Step 1: Install TypeScript**
```bash
npm install --save-dev typescript @types/node @types/react @types/react-dom
npm install --save-dev ts-node tsx
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### **Step 2: Install Chart Libraries**
```bash
cd client
npm install chart.js react-chartjs-2 chartjs-chart-financial chartjs-adapter-date-fns date-fns
```

### **Step 3: Create TypeScript Config**
```bash
# Root tsconfig
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["shared/*"],
      "@server/*": ["server/src/*"]
    }
  }
}
EOF

# Client tsconfig
cd client
cat > tsconfig.json << 'EOF'
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  }
}
EOF
```

### **Step 4: Create Shared Types Directory**
```bash
mkdir -p shared/types
touch shared/types/market.ts
touch shared/types/trading.ts
touch shared/types/strategy.ts
touch shared/types/risk.ts
```

### **Step 5: Git Commits (Atomic)**
```bash
# After API key setup
git add server/.env server/.env.example server/src/services/llmService.js server/src/index.js
git commit -m "feat: migrate LLM service from Anthropic to Gemini (free tier)"

# After creating types
git add shared/types/
git commit -m "feat: create TypeScript core types (Price, Pips, OHLC, etc.)"

# After each major component
git add server/src/core/risk/
git commit -m "feat: implement circuit breaker system (5 breakers + orchestrator)"
```

---

## **QUESTIONS FOR YOU**

Before I begin implementation:

1. **Approve API key storage?** I've created `server/.env` with your Gemini key. Confirm this is OK.

2. **Migration pace?** Should I:
   - A) Convert entire codebase to TypeScript in one go (~1 week)
   - B) Incremental migration (core logic first, UI later) (~2 weeks)

3. **Chart library preference?** I proposed `chartjs-chart-financial`. Alternatives:
   - Lightweight Candlesticks (React wrapper)
   - TradingView widget (embedded iframe)
   - D3.js custom (full control, more work)

4. **Live broker priority?** Should I implement OANDA stub now, or wait until Phase 3?

5. **Testing requirements?** Current: 45 unit tests. Target: 100+? Or focus on integration tests?

**Awaiting your go-ahead before writing code.**
