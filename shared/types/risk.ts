/**
 * Risk Management Types
 */

import { Timestamp } from './market';

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

export interface CircuitBreakerStatus {
  name: string;
  type: CircuitBreakerType;
  enabled: boolean;
  tripped: boolean;
  lastTripTime?: Timestamp;
  requiresManualReset: boolean;
  currentMetric?: {
    name: string;
    value: number;
    threshold: number;
    unit: string;
  };
}
