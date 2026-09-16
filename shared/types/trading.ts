/**
 * Trading Types
 */

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
  size: number; // position size in lots
  
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
  
  signal?: Signal;
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
