/**
 * Promotion Checklist — Paper → Live Gate
 * 
 * REPLACES v1 CHECKLIST WITH HARDER NUMBERS
 * 
 * These are NOT suggestions. These are GATES. You cannot arm live trading
 * until all pass, enforced server-side.
 * 
 * WHY THESE SPECIFIC NUMBERS:
 * - 7 days: Captures different market conditions (not just one lucky day)
 * - 30 trades: Statistical significance floor (below this, metrics are noise)
 * - PF > 1.3: Buffer above break-even (1.0) for real-world slippage
 * - Sharpe > 1.0: Minimum consistency (returns exceed volatility)
 * - Drawdown: Must be tolerable WITH REAL MONEY (not just on paper)
 * - Breakers tested: Each one must actually work when triggered
 */

import { PerformanceMetrics } from '../analytics/performanceMetrics';
import { Trade } from '../analytics/performanceMetrics';

export interface PromotionChecklistResult {
  passed: boolean;
  checks: CheckResult[];
  summary: string;
  warnings: string[];
}

export interface CheckResult {
  name: string;
  passed: boolean;
  required: any;
  actual: any;
  severity: 'critical' | 'warning';
  reason?: string;
}

/**
 * Validate promotion criteria — ALL must pass
 */
export function validatePromotionChecklist(
  trades: Trade[],
  metrics: PerformanceMetrics,
  context: {
    paperTradingStartDate: number; // Unix timestamp
    maxDrawdownTolerance: number; // User's actual risk tolerance
    circuitBreakersTestedManually: boolean;
    liveBrokerAdapterTested: boolean;
    llmRationaleReviewed: boolean;
  }
): PromotionChecklistResult {
  const checks: CheckResult[] = [];
  
  // 1. Minimum 7 days continuous paper trading
  const daysPaperTrading = (Date.now() - context.paperTradingStartDate) / (1000 * 60 * 60 * 24);
  checks.push({
    name: '7 Days Continuous Paper Trading',
    passed: daysPaperTrading >= 7,
    required: '≥ 7 days',
    actual: `${daysPaperTrading.toFixed(1)} days`,
    severity: 'critical',
    reason: 'Captures different market conditions (not just one lucky day)',
  });
  
  // 2. Minimum 30 closed trades
  checks.push({
    name: 'Minimum Trade Count',
    passed: metrics.totalTrades >= 30,
    required: '≥ 30 trades',
    actual: `${metrics.totalTrades} trades`,
    severity: 'critical',
    reason: 'Statistical significance floor. Below this, metrics are noise.',
  });
  
  // 3. Profit Factor > 1.3
  checks.push({
    name: 'Profit Factor',
    passed: metrics.profitFactor > 1.3,
    required: '> 1.3',
    actual: metrics.profitFactor.toFixed(2),
    severity: 'critical',
    reason: 'Buffer above break-even (1.0) for real-world slippage/commissions',
  });
  
  // 4. Sharpe Ratio > 1.0
  checks.push({
    name: 'Sharpe Ratio',
    passed: metrics.sharpeRatio > 1.0,
    required: '> 1.0',
    actual: metrics.sharpeRatio.toFixed(2),
    severity: 'critical',
    reason: 'Minimum consistency requirement (returns must exceed volatility)',
  });
  
  // 5. Max Drawdown within tolerance
  const drawdownWithinTolerance = metrics.maxDrawdownPct <= context.maxDrawdownTolerance;
  checks.push({
    name: 'Max Drawdown Tolerance',
    passed: drawdownWithinTolerance,
    required: `≤ ${context.maxDrawdownTolerance}%`,
    actual: `${metrics.maxDrawdownPct.toFixed(1)}%`,
    severity: 'critical',
    reason: 'Must be tolerable WITH REAL MONEY, not just acceptable on paper',
  });
  
  // 6. Circuit breakers tested manually
  checks.push({
    name: 'Circuit Breakers Tested',
    passed: context.circuitBreakersTestedManually,
    required: 'All breakers triggered manually at least once',
    actual: context.circuitBreakersTestedManually ? 'Tested' : 'Not tested',
    severity: 'critical',
    reason: 'Must verify each breaker actually halts trading when triggered',
  });
  
  // 7. Live broker adapter tested
  checks.push({
    name: 'Live Broker Adapter Tested',
    passed: context.liveBrokerAdapterTested,
    required: 'Tested against broker sandbox/practice account',
    actual: context.liveBrokerAdapterTested ? 'Tested' : 'Not tested',
    severity: 'critical',
    reason: 'Must verify orders actually reach broker and execute correctly',
  });
  
  // 8. LLM rationale reviewed
  checks.push({
    name: 'LLM Rationale Quality',
    passed: context.llmRationaleReviewed,
    required: 'Sample of post-trade notes reviewed for soundness',
    actual: context.llmRationaleReviewed ? 'Reviewed' : 'Not reviewed',
    severity: 'warning',
    reason: 'Verify LLM provides sound reasoning, not confident-sounding filler',
  });
  
  // 9. Expectancy > 0 (sanity check)
  checks.push({
    name: 'Positive Expectancy',
    passed: metrics.expectancy > 0,
    required: '> $0 per trade',
    actual: `$${metrics.expectancy.toFixed(2)} per trade`,
    severity: 'critical',
    reason: 'Fundamental: must make money on average per trade',
  });
  
  // 10. Win rate sanity check (not < 30% or > 80%)
  const winRateSane = metrics.winRate >= 30 && metrics.winRate <= 80;
  checks.push({
    name: 'Win Rate Sanity Check',
    passed: winRateSane,
    required: '30-80%',
    actual: `${metrics.winRate.toFixed(1)}%`,
    severity: 'warning',
    reason: 'Extreme win rates often indicate overfitting or unrealistic expectations',
  });
  
  // Determine overall pass/fail
  const criticalChecks = checks.filter(c => c.severity === 'critical');
  const criticalFailed = criticalChecks.filter(c => !c.passed);
  const passed = criticalFailed.length === 0;
  
  // Generate summary
  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;
  const criticalFailedCount = criticalFailed.length;
  
  let summary = '';
  if (passed) {
    summary = `✅ PROMOTION APPROVED: All ${criticalChecks.length} critical checks passed (${passedCount}/${totalCount} total checks passed)`;
  } else {
    summary = `❌ PROMOTION BLOCKED: ${criticalFailedCount} critical check(s) failed. Continue paper trading.`;
  }
  
  // Warnings
  const warnings: string[] = [];
  checks.filter(c => !c.passed && c.severity === 'warning').forEach(c => {
    warnings.push(`⚠️ ${c.name}: ${c.reason}`);
  });
  
  return {
    passed,
    checks,
    summary,
    warnings,
  };
}

/**
 * Format checklist for display
 */
export function formatPromotionChecklist(result: PromotionChecklistResult): string {
  let output = '\n';
  output += '='.repeat(70) + '\n';
  output += 'PROMOTION CHECKLIST — PAPER → LIVE\n';
  output += '='.repeat(70) + '\n\n';
  
  output += result.summary + '\n\n';
  
  result.checks.forEach(check => {
    const icon = check.passed ? '✅' : '❌';
    const severity = check.severity === 'critical' ? '[CRITICAL]' : '[WARNING]';
    output += `${icon} ${check.name} ${severity}\n`;
    output += `   Required: ${check.required}\n`;
    output += `   Actual: ${check.actual}\n`;
    output += `   Why: ${check.reason}\n\n`;
  });
  
  if (result.warnings.length > 0) {
    output += 'WARNINGS:\n';
    result.warnings.forEach(w => {
      output += `${w}\n`;
    });
    output += '\n';
  }
  
  if (!result.passed) {
    output += '🛑 LIVE TRADING BLOCKED\n';
    output += 'Fix critical issues above before attempting live trading.\n';
    output += 'This gate is enforced server-side — you cannot bypass it.\n';
  } else {
    output += '🚀 CLEARED FOR LIVE TRADING\n';
    output += 'All critical criteria met. You may proceed to live trading.\n';
    output += 'Start with minimum position size and monitor closely.\n';
  }
  
  output += '='.repeat(70) + '\n';
  
  return output;
}

/**
 * Example usage:
 * 
 * const result = validatePromotionChecklist(trades, metrics, {
 *   paperTradingStartDate: Date.now() - (10 * 24 * 60 * 60 * 1000), // 10 days ago
 *   maxDrawdownTolerance: 15, // 15% max drawdown
 *   circuitBreakersTestedManually: true,
 *   liveBrokerAdapterTested: true,
 *   llmRationaleReviewed: true,
 * });
 * 
 * console.log(formatPromotionChecklist(result));
 * 
 * if (result.passed) {
 *   // Enable live trading
 * } else {
 *   // Show blockers to user
 * }
 */
