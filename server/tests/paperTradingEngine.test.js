import {
  createPosition,
  updatePositionPnL,
  checkExitConditions,
  closePosition,
  calculatePortfolioStats
} from '../src/utils/paperTradingEngine.js';

describe('Paper Trading Engine', () => {
  
  describe('createPosition', () => {
    test('creates valid BUY position', () => {
      const position = createPosition({
        pair: 'EUR/USD',
        direction: 'BUY',
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1200,
        size: 10000
      });

      expect(position.direction).toBe('BUY');
      expect(position.entryPrice).toBe(1.1000);
      expect(position.status).toBe('open');
      expect(position.risk.pips).toBeCloseTo(100, 0);
      expect(position.reward.pips).toBeCloseTo(200, 0);
      expect(position.riskRewardRatio).toBeCloseTo(2, 1);
    });

    test('creates valid SELL position', () => {
      const position = createPosition({
        pair: 'EUR/USD',
        direction: 'SELL',
        entryPrice: 1.1000,
        stopLoss: 1.1100,
        takeProfit: 1.0800,
        size: 10000
      });

      expect(position.direction).toBe('SELL');
      expect(position.stopLoss).toBeGreaterThan(position.entryPrice);
      expect(position.takeProfit).toBeLessThan(position.entryPrice);
    });

    test('throws error for invalid stop loss direction (BUY)', () => {
      expect(() => createPosition({
        pair: 'EUR/USD',
        direction: 'BUY',
        entryPrice: 1.1000,
        stopLoss: 1.1100, // Above entry - invalid for BUY
        takeProfit: 1.1200
      })).toThrow('stop loss must be below entry price');
    });

    test('throws error for invalid stop loss direction (SELL)', () => {
      expect(() => createPosition({
        pair: 'EUR/USD',
        direction: 'SELL',
        entryPrice: 1.1000,
        stopLoss: 1.0900, // Below entry - invalid for SELL
        takeProfit: 1.0800
      })).toThrow('stop loss must be above entry price');
    });

    test('throws error for missing required fields', () => {
      expect(() => createPosition({
        pair: 'EUR/USD',
        direction: 'BUY',
        entryPrice: 1.1000
        // Missing stopLoss and takeProfit
      })).toThrow('Stop loss and take profit are required');
    });
  });

  describe('updatePositionPnL', () => {
    test('calculates positive P&L for winning BUY position', () => {
      const position = createPosition({
        pair: 'EUR/USD',
        direction: 'BUY',
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1200,
        size: 10000
      });

      const updated = updatePositionPnL(position, 1.1050);
      
      expect(updated.pnl.pips).toBeCloseTo(50, 0);
      expect(updated.pnl.unrealized).toBeCloseTo(50, 0);
    });

    test('calculates negative P&L for losing BUY position', () => {
      const position = createPosition({
        pair: 'EUR/USD',
        direction: 'BUY',
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1200,
        size: 10000
      });

      const updated = updatePositionPnL(position, 1.0950);
      
      expect(updated.pnl.pips).toBeCloseTo(-50, 0);
      expect(updated.pnl.unrealized).toBeCloseTo(-50, 0);
    });

    test('calculates positive P&L for winning SELL position', () => {
      const position = createPosition({
        pair: 'EUR/USD',
        direction: 'SELL',
        entryPrice: 1.1000,
        stopLoss: 1.1100,
        takeProfit: 1.0800,
        size: 10000
      });

      const updated = updatePositionPnL(position, 1.0950);
      
      expect(updated.pnl.pips).toBeCloseTo(50, 0);
      expect(updated.pnl.unrealized).toBeCloseTo(50, 0);
    });
  });

  describe('checkExitConditions', () => {
    test('detects stop loss hit for BUY position', () => {
      const position = createPosition({
        pair: 'EUR/USD',
        direction: 'BUY',
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1200
      });

      const exit = checkExitConditions(position, 1.0890);
      
      expect(exit).not.toBeNull();
      expect(exit.reason).toBe('stop_loss');
    });

    test('detects take profit hit for BUY position', () => {
      const position = createPosition({
        pair: 'EUR/USD',
        direction: 'BUY',
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1200
      });

      const exit = checkExitConditions(position, 1.1210);
      
      expect(exit).not.toBeNull();
      expect(exit.reason).toBe('take_profit');
    });

    test('returns null when no exit conditions met', () => {
      const position = createPosition({
        pair: 'EUR/USD',
        direction: 'BUY',
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1200
      });

      const exit = checkExitConditions(position, 1.1050);
      
      expect(exit).toBeNull();
    });
  });

  describe('closePosition', () => {
    test('closes position with realized P&L', () => {
      const position = createPosition({
        pair: 'EUR/USD',
        direction: 'BUY',
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1200,
        size: 10000
      });

      const closed = closePosition(position, 1.1100, 'take_profit');
      
      expect(closed.status).toBe('closed');
      expect(closed.exitPrice).toBe(1.1100);
      expect(closed.closeReason).toBe('take_profit');
      expect(closed.pnl.realized).toBeCloseTo(100, 0);
      expect(closed.pnl.pips).toBeCloseTo(100, 0);
    });

    test('throws error when trying to close already closed position', () => {
      const position = createPosition({
        pair: 'EUR/USD',
        direction: 'BUY',
        entryPrice: 1.1000,
        stopLoss: 1.0900,
        takeProfit: 1.1200
      });

      const closed = closePosition(position, 1.1100, 'manual');
      
      expect(() => closePosition(closed, 1.1050, 'manual')).toThrow('Position is not open');
    });
  });

  describe('calculatePortfolioStats', () => {
    test('returns zeros for empty portfolio', () => {
      const stats = calculatePortfolioStats([]);
      
      expect(stats.totalTrades).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.profitFactor).toBe(0);
    });

    test('calculates correct stats for mixed positions', () => {
      const positions = [];
      
      // Create and close 3 winners
      for (let i = 0; i < 3; i++) {
        const pos = createPosition({
          pair: 'EUR/USD',
          direction: 'BUY',
          entryPrice: 1.1000,
          stopLoss: 1.0900,
          takeProfit: 1.1200,
          size: 10000
        });
        positions.push(closePosition(pos, 1.1100, 'take_profit'));
      }
      
      // Create and close 2 losers
      for (let i = 0; i < 2; i++) {
        const pos = createPosition({
          pair: 'EUR/USD',
          direction: 'BUY',
          entryPrice: 1.1000,
          stopLoss: 1.0900,
          takeProfit: 1.1200,
          size: 10000
        });
        positions.push(closePosition(pos, 1.0910, 'stop_loss'));
      }
      
      const stats = calculatePortfolioStats(positions);
      
      expect(stats.totalTrades).toBe(5);
      expect(stats.winners).toBe(3);
      expect(stats.losers).toBe(2);
      expect(stats.winRate).toBeCloseTo(60, 0);
      expect(stats.profitFactor).toBeGreaterThan(1);
    });
  });
});
