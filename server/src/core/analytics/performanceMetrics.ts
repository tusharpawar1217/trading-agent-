/**
 * Performance Metrics Module
 * 
 * WHY WIN RATE ALONE IS MISLEADING:
 * 
 * A strategy that wins 80% of the time can still LOSE MONEY if:
 * - Win: +$10 (80% of trades)
 * - Loss: -$100 (20% of trades)
 * - Expectancy: (0.8 × $10) - (0.2 × $100) = $8 - $20 = -$12 per trade
 * 
 * You'd go broke with an "80% win rate" because the losses are catastrophic.
 * 
 * TRACK ALL OF THESE, NOT JUST WIN RATE:
 */

export interface Trade {
  id: string;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  direction: 'BUY' | 'SELL';
  size: number;
  pnl: number; // Profit/Loss in account currency
  pnlPct: number; // P&L as % of account at trade entry
  commission: number;
  pair: string;
  stopLoss?: number;
  takeProfit?: number;
  exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'TIME';
}

export interface PerformanceMetrics {
  // Trade counts
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  
  // Win/Loss stats
  winRate: number; // Percentage (0-100)
  lossRate: number; // Percentage (0-100)
  avgWin: number; // Average winning trade ($)
  avgLoss: number; // Average losing trade ($)
  largestWin: number;
  largestLoss: number;
  
  // The number that matters most
  expectancy: number; // Expected value per trade ($)
  expectancyPct: number; // Expected % return per trade
  
  // Risk-adjusted metrics
  profitFactor: number; // Gross profit ÷ gross loss
  sharpeRatio: number; // Return/risk ratio on trade series
  maxDrawdown: number; // Worst peak-to-valley ($)
  maxDrawdownPct: number; // Worst peak-to-valley (%)
  
  // Trading behavior
  avgHoldTime: number; // Average time in trade (seconds)
  avgWinHoldTime: number;
  avgLossHoldTime: number;
  
  // P&L totals
  totalPnL: number;
  totalCommissions: number;
  netPnL: number;
  
  // Current state
  currentStreak: number; // Positive = wins, negative = losses
  consecutiveWins: number;
  consecutiveLosses: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
}

/**
 * Calculate expectancy — the single most important metric
 * 
 * Formula:
 * expectancy = (win_rate × avg_win) - (loss_rate × avg_loss)
 * 
 * Interpretation:
 * - Positive: You make money on average per trade
 * - Negative: You lose money on average per trade
 * - Zero: Break-even strategy
 * 
 * Example:
 * Win rate: 45%, Avg win: $200
 * Loss rate: 55%, Avg loss: $100
 * Expectancy = (0.45 × $200) - (0.55 × $100) = $90 - $55 = $35 per trade
 * 
 * This 45% win rate strategy is PROFITABLE because wins are 2× losses.
 */
export function calculateExpectancy(
  winRate: number,
  avgWin: number,
  lossRate: number,
  avgLoss: number
): number {
  return (winRate * avgWin) - (lossRate * Math.abs(avgLoss));
}

/**
 * Calculate profit factor
 * 
 * Formula:
 * profit_factor = gross_profit ÷ gross_loss
 * 
 * Interpretation:
 * - > 1.0: Profitable (wins > losses)
 * - = 1.0: Break-even
 * - < 1.0: Unprofitable (losses > wins)
 * 
 * Example:
 * Gross profit: $10,000
 * Gross loss: $7,000
 * Profit factor = $10,000 / $7,000 = 1.43
 * 
 * For every $1 you lose, you make $1.43 back.
 */
export function calculateProfitFactor(
  grossProfit: number,
  grossLoss: number
): number {
  if (grossLoss === 0) {
    return grossProfit > 0 ? Infinity : 0;
  }
  return grossProfit / Math.abs(grossLoss);
}

/**
 * Calculate Sharpe ratio on trade returns
 * 
 * Formula:
 * sharpe = (mean_return - risk_free_rate) / std_dev_return
 * 
 * Interpretation:
 * - > 1.0: Good (returns exceed volatility)
 * - > 2.0: Very good
 * - > 3.0: Excellent
 * - < 1.0: Poor (too much volatility for the return)
 * 
 * WHY IT MATTERS:
 * Two strategies with same avg return:
 * - Strategy A: steady +2% per trade
 * - Strategy B: wild swings (+50%, -40%, +30%, -35%, etc)
 * 
 * Strategy A has higher Sharpe (more consistent).
 * Strategy B has lower Sharpe (same return but harder to stomach).
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0
): number {
  if (returns.length < 2) {
    return 0;
  }
  
  // Calculate mean return
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  
  // Calculate standard deviation
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) {
    return mean > riskFreeRate ? Infinity : 0;
  }
  
  return (mean - riskFreeRate) / stdDev;
}

/**
 * Calculate maximum drawdown
 * 
 * Definition:
 * Worst peak-to-valley decline in equity curve.
 * 
 * Example:
 * Equity: $10,000 → $12,000 → $9,500 → $11,000
 * Peak: $12,000
 * Valley: $9,500
 * Drawdown: $12,000 - $9,500 = $2,500 (20.8%)
 * 
 * WHY IT MATTERS:
 * This is the number that determines whether you can ACTUALLY stomach
 * running this with real money. A strategy with 50% drawdown might be
 * "profitable on paper" but you'll quit before recovering.
 * 
 * @returns { amount: $ drawdown, percentage: %, peak, valley }
 */
export function calculateMaxDrawdown(
  equityCurve: number[]
): { amount: number; percentage: number; peak: number; valley: number; peakIdx: number; valleyIdx: number } {
  if (equityCurve.length === 0) {
    return { amount: 0, percentage: 0, peak: 0, valley: 0, peakIdx: -1, valleyIdx: -1 };
  }
  
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  let peak = equityCurve[0];
  let peakIdx = 0;
  let valleyIdx = 0;
  let recordPeak = equityCurve[0];
  let recordValley = equityCurve[0];
  
  for (let i = 1; i < equityCurve.length; i++) {
    const current = equityCurve[i];
    
    // Update peak if new high
    if (current > peak) {
      peak = current;
      peakIdx = i;
    }
    
    // Calculate drawdown from current peak
    const drawdown = peak - current;
    const drawdownPct = (drawdown / peak) * 100;
    
    // Update max drawdown if worse
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPct = drawdownPct;
      recordPeak = peak;
      recordValley = current;
      valleyIdx = i;
    }
  }
  
  return {
    amount: maxDrawdown,
    percentage: maxDrawdownPct,
    peak: recordPeak,
    valley: recordValley,
    peakIdx,
    valleyIdx,
  };
}

/**
 * Calculate comprehensive performance metrics from trade history
 */
export function calculatePerformanceMetrics(trades: Trade[]): PerformanceMetrics {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakEvenTrades: 0,
      winRate: 0,
      lossRate: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      expectancy: 0,
      expectancyPct: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      avgHoldTime: 0,
      avgWinHoldTime: 0,
      avgLossHoldTime: 0,
      totalPnL: 0,
      totalCommissions: 0,
      netPnL: 0,
      currentStreak: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
    };
  }
  
  // Separate wins, losses, break-evens
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const breakEvens = trades.filter(t => t.pnl === 0);
  
  // Basic counts
  const totalTrades = trades.length;
  const winningTrades = wins.length;
  const losingTrades = losses.length;
  const breakEvenTrades = breakEvens.length;
  
  // Rates
  const winRate = winningTrades / totalTrades;
  const lossRate = losingTrades / totalTrades;
  
  // Averages
  const avgWin = wins.length > 0 
    ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length 
    : 0;
  const avgLoss = losses.length > 0 
    ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length 
    : 0;
  
  // Extremes
  const largestWin = wins.length > 0 
    ? Math.max(...wins.map(t => t.pnl)) 
    : 0;
  const largestLoss = losses.length > 0 
    ? Math.min(...losses.map(t => t.pnl)) 
    : 0;
  
  // Expectancy
  const expectancy = calculateExpectancy(winRate, avgWin, lossRate, avgLoss);
  const expectancyPct = trades.length > 0
    ? trades.reduce((sum, t) => sum + t.pnlPct, 0) / trades.length
    : 0;
  
  // Profit factor
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = calculateProfitFactor(grossProfit, grossLoss);
  
  // Sharpe ratio
  const returns = trades.map(t => t.pnlPct);
  const sharpeRatio = calculateSharpeRatio(returns);
  
  // Equity curve (for max drawdown)
  let runningEquity = 10000; // Assume starting equity
  const equityCurve = [runningEquity];
  trades.forEach(t => {
    runningEquity += t.pnl;
    equityCurve.push(runningEquity);
  });
  
  const maxDD = calculateMaxDrawdown(equityCurve);
  
  // Hold times
  const holdTimes = trades.map(t => t.exitTime - t.entryTime);
  const avgHoldTime = holdTimes.reduce((sum, t) => sum + t, 0) / holdTimes.length;
  
  const winHoldTimes = wins.map(t => t.exitTime - t.entryTime);
  const avgWinHoldTime = winHoldTimes.length > 0
    ? winHoldTimes.reduce((sum, t) => sum + t, 0) / winHoldTimes.length
    : 0;
  
  const lossHoldTimes = losses.map(t => t.exitTime - t.entryTime);
  const avgLossHoldTime = lossHoldTimes.length > 0
    ? lossHoldTimes.reduce((sum, t) => sum + t, 0) / lossHoldTimes.length
    : 0;
  
  // P&L totals
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalCommissions = trades.reduce((sum, t) => sum + t.commission, 0);
  const netPnL = totalPnL - totalCommissions;
  
  // Streaks
  let currentStreak = 0;
  let consecutiveWins = 0;
  let consecutiveLosses = 0;
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  
  trades.forEach(t => {
    if (t.pnl > 0) {
      consecutiveWins++;
      consecutiveLosses = 0;
      currentStreak = consecutiveWins;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
    } else if (t.pnl < 0) {
      consecutiveLosses++;
      consecutiveWins = 0;
      currentStreak = -consecutiveLosses;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
    }
  });
  
  return {
    totalTrades,
    winningTrades,
    losingTrades,
    breakEvenTrades,
    winRate: winRate * 100,
    lossRate: lossRate * 100,
    avgWin,
    avgLoss,
    largestWin,
    largestLoss,
    expectancy,
    expectancyPct,
    profitFactor,
    sharpeRatio,
    maxDrawdown: maxDD.amount,
    maxDrawdownPct: maxDD.percentage,
    avgHoldTime,
    avgWinHoldTime,
    avgLossHoldTime,
    totalPnL,
    totalCommissions,
    netPnL,
    currentStreak,
    consecutiveWins,
    consecutiveLosses,
    maxConsecutiveWins,
    maxConsecutiveLosses,
  };
}

/**
 * Format metrics for display
 */
export function formatMetrics(metrics: PerformanceMetrics): string {
  return `
PERFORMANCE METRICS
===================

Trade Counts:
  Total Trades: ${metrics.totalTrades}
  Wins: ${metrics.winningTrades} (${metrics.winRate.toFixed(1)}%)
  Losses: ${metrics.losingTrades} (${metrics.lossRate.toFixed(1)}%)

The Number That Matters:
  Expectancy: $${metrics.expectancy.toFixed(2)} per trade
  (Win rate alone means nothing - this is what counts)

Risk-Adjusted Returns:
  Profit Factor: ${metrics.profitFactor.toFixed(2)} (must be > 1.0)
  Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)} (higher = more consistent)
  Max Drawdown: $${metrics.maxDrawdown.toFixed(2)} (${metrics.maxDrawdownPct.toFixed(1)}%)

P&L:
  Gross P&L: $${metrics.totalPnL.toFixed(2)}
  Commissions: $${metrics.totalCommissions.toFixed(2)}
  Net P&L: $${metrics.netPnL.toFixed(2)}

Win/Loss Details:
  Avg Win: $${metrics.avgWin.toFixed(2)}
  Avg Loss: $${metrics.avgLoss.toFixed(2)}
  Largest Win: $${metrics.largestWin.toFixed(2)}
  Largest Loss: $${metrics.largestLoss.toFixed(2)}

Current State:
  Streak: ${metrics.currentStreak > 0 ? `${metrics.currentStreak} wins` : `${Math.abs(metrics.currentStreak)} losses`}
  Max Consecutive Wins: ${metrics.maxConsecutiveWins}
  Max Consecutive Losses: ${metrics.maxConsecutiveLosses}
`;
}
