/**
 * Base Circuit Breaker Class
 * 
 * Circuit breakers automatically halt trading when risk thresholds are exceeded.
 * Philosophy: Fail-safe, not fail-silent.
 */

import { CircuitBreakerResult } from '../../../shared/types/risk';
import { toTimestamp, Timestamp } from '../../../shared/types/market';

export abstract class CircuitBreaker {
  protected _tripped: boolean = false;
  protected _lastTripTime?: Timestamp;
  protected _tripCount: number = 0;
  
  constructor(
    public readonly name: string,
    public enabled: boolean = true,
    public readonly resetRequiresManual: boolean = true
  ) {}
  
  get tripped(): boolean {
    return this._tripped;
  }
  
  get lastTripTime(): Timestamp | undefined {
    return this._lastTripTime;
  }
  
  get tripCount(): number {
    return this._tripCount;
  }
  
  /**
   * Check if this breaker allows the action
   * 
   * @param context - Optional context (pair, position, etc.)
   * @returns { allowed: true } or { allowed: false, reason: '...' }
   */
  abstract check(context?: any): Promise<CircuitBreakerResult>;
  
  /**
   * Trip the breaker (called internally when threshold exceeded)
   */
  protected trip(reason: string, metric?: {
    name: string;
    current: number;
    threshold: number;
    unit: string;
  }): void {
    this._tripped = true;
    this._lastTripTime = toTimestamp(Date.now());
    this._tripCount++;
    
    // Log to console (in production, send to monitoring system)
    console.error('═'.repeat(60));
    console.error('🚨 CIRCUIT BREAKER TRIPPED');
    console.error('═'.repeat(60));
    console.error(`Breaker:   ${this.name}`);
    console.error(`Reason:    ${reason}`);
    console.error(`Time:      ${new Date(this._lastTripTime).toISOString()}`);
    console.error(`Trip #:    ${this._tripCount}`);
    
    if (metric) {
      console.error(`Metric:    ${metric.name}`);
      console.error(`Current:   ${metric.current.toFixed(2)} ${metric.unit}`);
      console.error(`Threshold: ${metric.threshold.toFixed(2)} ${metric.unit}`);
    }
    
    console.error('═'.repeat(60));
    console.error('⚠️  ALL NEW TRADING HALTED');
    console.error('   Manual reset required via API: POST /api/risk/reset');
    console.error('═'.repeat(60));
    
    // TODO: Send alert
    // - Email to trader
    // - SMS notification
    // - Slack/Discord webhook
    // - Push notification
    this.sendAlert(reason, metric);
  }
  
  /**
   * Send alert notification (override in production)
   */
  protected sendAlert(reason: string, metric?: any): void {
    // Placeholder for alert system integration
    // In production, implement:
    // - Email via SendGrid/Mailgun
    // - SMS via Twilio
    // - Slack webhook
    // - Discord webhook
  }
  
  /**
   * Reset the breaker (only if auto-reset allowed)
   */
  reset(): void {
    if (this.resetRequiresManual) {
      console.warn(`⚠️  Breaker "${this.name}" requires manual reset via API`);
      return;
    }
    
    this._tripped = false;
    console.log(`✅ Circuit breaker auto-reset: ${this.name}`);
  }
  
  /**
   * Force reset (for manual intervention via API)
   * 
   * @param authorizedBy - Username/ID of person resetting
   */
  forceReset(authorizedBy: string): void {
    this._tripped = false;
    console.log('─'.repeat(60));
    console.log(`✅ CIRCUIT BREAKER FORCE RESET`);
    console.log(`   Breaker:      ${this.name}`);
    console.log(`   Authorized:   ${authorizedBy}`);
    console.log(`   Time:         ${new Date().toISOString()}`);
    console.log(`   Previous trips: ${this._tripCount}`);
    console.log('─'.repeat(60));
  }
  
  /**
   * Get current status
   */
  getStatus(): {
    name: string;
    enabled: boolean;
    tripped: boolean;
    tripCount: number;
    lastTripTime?: string;
    requiresManualReset: boolean;
  } {
    return {
      name: this.name,
      enabled: this.enabled,
      tripped: this._tripped,
      tripCount: this._tripCount,
      lastTripTime: this._lastTripTime 
        ? new Date(this._lastTripTime).toISOString()
        : undefined,
      requiresManualReset: this.resetRequiresManual,
    };
  }
}
