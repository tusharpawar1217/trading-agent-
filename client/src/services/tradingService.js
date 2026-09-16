/**
 * Trading Service
 * Client-side implementation of paper trading logic
 */

/**
 * Create a paper position
 */
export function createPosition({
  pair,
  direction,
  entryPrice,
  stopLoss,
  takeProfit,
  size = 1000,
  signal = null,
  notes = ''
}) {
  if (!['BUY', 'SELL'].includes(direction)) {
    throw new Error('Direction must be BUY or SELL');
  }

  if (stopLoss === undefined || takeProfit === undefined) {
    throw new Error('Stop loss and take profit are required');
  }

  // Validate stop loss direction
  if (direction === 'BUY' && stopLoss >= entryPrice) {
    throw new Error('For BUY positions, stop loss must be below entry price');
  }
  if (direction === 'SELL' && stopLoss <= entryPrice) {
    throw new Error('For SELL positions, stop loss must be above entry price');
  }

  const riskPips = Math.abs(entryPrice - stopLoss) * 10000;
  const rewardPips = Math.abs(takeProfit - entryPrice) * 10000;
  const riskRewardRatio = rewardPips / riskPips;

  return {
    id: generatePositionId(),
    pair,
    direction,
    entryPrice,
    stopLoss,
    takeProfit,
    size,
    entryTime: new Date().toISOString(),
    status: 'open',
    signal: signal || null,
    notes,
    risk: {
      pips: riskPips,
      amount: (riskPips / 10000) * size
    },
    reward: {
      pips: rewardPips,
      amount: (rewardPips / 10000) * size
    },
    riskRewardRatio,
    pnl: {
      unrealized: 0,
      realized: null,
      pips: 0
    }
  };
}

/**
 * Update position P&L with current price
 */
export function updatePositionPnL(position, currentPrice) {
  if (position.status !== 'open') {
    return position;
  }

  let pnlPips, pnlAmount;
  
  if (position.direction === 'BUY') {
    pnlPips = (currentPrice - position.entryPrice) * 10000;
  } else {
    pnlPips = (position.entryPrice - currentPrice) * 10000;
  }
  
  pnlAmount = (pnlPips / 10000) * position.size;

  return {
    ...position,
    currentPrice,
    pnl: {
      unrealized: pnlAmount,
      realized: null,
      pips: pnlPips
    }
  };
}

/**
 * Check if position should be closed
 */
export function checkExitConditions(position, currentPrice) {
  if (position.status !== 'open') {
    return null;
  }

  if (position.direction === 'BUY') {
    if (currentPrice <= position.stopLoss) {
      return { reason: 'stop_loss', price: position.stopLoss };
    }
    if (currentPrice >= position.takeProfit) {
      return { reason: 'take_profit', price: position.takeProfit };
    }
  } else {
    if (currentPrice >= position.stopLoss) {
      return { reason: 'stop_loss', price: position.stopLoss };
    }
    if (currentPrice <= position.takeProfit) {
      return { reason: 'take_profit', price: position.takeProfit };
    }
  }

  return null;
}

/**
 * Close a position
 */
export function closePosition(position, exitPrice, reason = 'manual') {
  if (position.status !== 'open') {
    throw new Error('Position is not open');
  }

  let pnlPips, pnlAmount;
  
  if (position.direction === 'BUY') {
    pnlPips = (exitPrice - position.entryPrice) * 10000;
  } else {
    pnlPips = (position.entryPrice - exitPrice) * 10000;
  }
  
  pnlAmount = (pnlPips / 10000) * position.size;

  return {
    ...position,
    status: 'closed',
    exitPrice,
    exitTime: new Date().toISOString(),
    closeReason: reason,
    pnl: {
      unrealized: 0,
      realized: pnlAmount,
      pips: pnlPips
    }
  };
}

/**
 * Calculate portfolio statistics
 */
export function calculatePortfolioStats(positions) {
  const closedPositions = positions.filter(p => p.status === 'closed');
  const openPositions = positions.filter(p => p.status === 'open');

  if (closedPositions.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      totalPnL: 0,
      totalPips: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      openPositions: openPositions.length,
      totalOpenRisk: openPositions.reduce((sum, p) => sum + p.risk.amount, 0)
    };
  }

  const winners = closedPositions.filter(p => p.pnl.realized > 0);
  const losers = closedPositions.filter(p => p.pnl.realized < 0);
  
  const totalPnL = closedPositions.reduce((sum, p) => sum + p.pnl.realized, 0);
  const totalPips = closedPositions.reduce((sum, p) => sum + p.pnl.pips, 0);
  
  const grossProfit = winners.reduce((sum, p) => sum + p.pnl.realized, 0);
  const grossLoss = Math.abs(losers.reduce((sum, p) => sum + p.pnl.realized, 0));
  
  const avgWin = winners.length > 0 ? grossProfit / winners.length : 0;
  const avgLoss = losers.length > 0 ? grossLoss / losers.length : 0;
  
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  return {
    totalTrades: closedPositions.length,
    winners: winners.length,
    losers: losers.length,
    winRate: (winners.length / closedPositions.length) * 100,
    totalPnL,
    totalPips,
    avgWin,
    avgLoss,
    profitFactor,
    grossProfit,
    grossLoss,
    openPositions: openPositions.length,
    totalOpenRisk: openPositions.reduce((sum, p) => sum + p.risk.amount, 0)
  };
}

function generatePositionId() {
  return `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
