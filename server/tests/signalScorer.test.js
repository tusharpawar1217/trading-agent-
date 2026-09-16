import { computeSignal, calculateStopLoss, calculateTakeProfit } from '../src/utils/signalScorer.js';

describe('Signal Scorer', () => {
  
  // Helper to create test market data
  function createMarketData(overrides = {}) {
    const defaultData = {
      pair: 'EUR/USD',
      data: Array.from({ length: 60 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 1.10 + (i * 0.001),
        high: 1.101 + (i * 0.001),
        low: 1.099 + (i * 0.001),
        close: 1.10 + (i * 0.001),
      }))
    };
    
    return { ...defaultData, ...overrides };
  }

  describe('computeSignal', () => {
    test('throws error for invalid market data', () => {
      expect(() => computeSignal(null)).toThrow('Invalid market data');
      expect(() => computeSignal({ data: [] })).toThrow('Invalid market data');
    });

    test('throws error for insufficient data', () => {
      const marketData = createMarketData();
      marketData.data = marketData.data.slice(0, 20); // Only 20 candles
      
      expect(() => computeSignal(marketData)).toThrow('Insufficient data');
    });

    test('generates signal with correct structure', () => {
      const marketData = createMarketData();
      const signal = computeSignal(marketData);
      
      expect(signal).toHaveProperty('pair');
      expect(signal).toHaveProperty('verdict');
      expect(signal).toHaveProperty('score');
      expect(signal).toHaveProperty('confidence');
      expect(signal).toHaveProperty('reasons');
      expect(signal).toHaveProperty('timestamp');
      expect(signal).toHaveProperty('marketData');
      
      expect(['BUY', 'SELL', 'HOLD']).toContain(signal.verdict);
      expect(signal.confidence).toBeGreaterThanOrEqual(0);
      expect(signal.confidence).toBeLessThanOrEqual(100);
      expect(Array.isArray(signal.reasons)).toBe(true);
    });

    test('verdict is BUY when score >= 2', () => {
      // Create data that will trigger bullish rules
      const marketData = createMarketData();
      // Make price trending up strongly
      marketData.data = marketData.data.map((candle, i) => ({
        ...candle,
        close: 1.05 + (i * 0.002) // Strong uptrend
      }));
      
      const signal = computeSignal(marketData);
      
      if (signal.score >= 2) {
        expect(signal.verdict).toBe('BUY');
      }
    });

    test('verdict is SELL when score <= -2', () => {
      // Create data that will trigger bearish rules
      const marketData = createMarketData();
      // Make price trending down strongly
      marketData.data = marketData.data.map((candle, i) => ({
        ...candle,
        close: 1.15 - (i * 0.002) // Strong downtrend
      }));
      
      const signal = computeSignal(marketData);
      
      if (signal.score <= -2) {
        expect(signal.verdict).toBe('SELL');
      }
    });

    test('verdict is HOLD when -1 <= score <= 1', () => {
      const marketData = createMarketData();
      // Sideways market - should produce neutral score
      marketData.data = marketData.data.map((candle, i) => ({
        ...candle,
        close: 1.10 + Math.sin(i / 10) * 0.005 // Oscillating
      }));
      
      const signal = computeSignal(marketData);
      
      if (signal.score > -2 && signal.score < 2) {
        expect(signal.verdict).toBe('HOLD');
      }
    });

    test('confidence calculation is correct', () => {
      const marketData = createMarketData();
      const signal = computeSignal(marketData);
      
      const expectedConfidence = Math.min(100, Math.abs(signal.score) / 4 * 100);
      expect(signal.confidence).toBeCloseTo(expectedConfidence, 2);
    });

    test('reasons array contains rule details', () => {
      const marketData = createMarketData();
      const signal = computeSignal(marketData);
      
      expect(signal.reasons.length).toBeGreaterThan(0);
      
      signal.reasons.forEach(reason => {
        expect(reason).toHaveProperty('rule');
        expect(reason).toHaveProperty('condition');
        expect(reason).toHaveProperty('value');
        expect(reason).toHaveProperty('score');
        expect(reason).toHaveProperty('interpretation');
        expect([1, -1]).toContain(reason.score);
      });
    });

    test('market data snapshot is included', () => {
      const marketData = createMarketData();
      const signal = computeSignal(marketData);
      
      expect(signal.marketData).toHaveProperty('currentPrice');
      expect(signal.marketData).toHaveProperty('rsi');
      expect(signal.marketData).toHaveProperty('macdHistogram');
      expect(signal.marketData).toHaveProperty('sma50');
      expect(signal.marketData).toHaveProperty('bollingerBands');
    });
  });

  describe('calculateStopLoss', () => {
    test('calculates stop loss for BUY direction', () => {
      const entryPrice = 1.1000;
      const stopLoss = calculateStopLoss(entryPrice, 'BUY');
      
      expect(stopLoss).toBeLessThan(entryPrice);
      expect(stopLoss).toBeCloseTo(1.1000 * 0.99, 4);
    });

    test('calculates stop loss for SELL direction', () => {
      const entryPrice = 1.1000;
      const stopLoss = calculateStopLoss(entryPrice, 'SELL');
      
      expect(stopLoss).toBeGreaterThan(entryPrice);
      expect(stopLoss).toBeCloseTo(1.1000 * 1.01, 4);
    });

    test('throws error for invalid direction', () => {
      expect(() => calculateStopLoss(1.1000, 'INVALID')).toThrow('Invalid direction');
    });
  });

  describe('calculateTakeProfit', () => {
    test('calculates take profit for BUY with 2:1 R:R', () => {
      const entryPrice = 1.1000;
      const stopLoss = 1.0900; // 100 pips risk
      const takeProfit = calculateTakeProfit(entryPrice, stopLoss, 'BUY', 2);
      
      expect(takeProfit).toBeGreaterThan(entryPrice);
      expect(takeProfit).toBeCloseTo(1.1200, 4); // 200 pips reward
    });

    test('calculates take profit for SELL with 2:1 R:R', () => {
      const entryPrice = 1.1000;
      const stopLoss = 1.1100; // 100 pips risk
      const takeProfit = calculateTakeProfit(entryPrice, stopLoss, 'SELL', 2);
      
      expect(takeProfit).toBeLessThan(entryPrice);
      expect(takeProfit).toBeCloseTo(1.0800, 4); // 200 pips reward
    });

    test('respects custom risk:reward ratio', () => {
      const entryPrice = 1.1000;
      const stopLoss = 1.0950; // 50 pips risk
      const takeProfit = calculateTakeProfit(entryPrice, stopLoss, 'BUY', 3);
      
      expect(takeProfit).toBeCloseTo(1.1150, 4); // 150 pips reward (3:1)
    });
  });
});
