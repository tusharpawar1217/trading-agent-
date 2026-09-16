import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
} from '../src/utils/indicators.js';

describe('Technical Indicators', () => {
  
  describe('SMA (Simple Moving Average)', () => {
    test('calculates 3-period SMA correctly', () => {
      const data = [1, 2, 3, 4, 5, 6];
      const result = calculateSMA(data, 3);
      
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
      expect(result[2]).toBe(2); // (1+2+3)/3
      expect(result[3]).toBe(3); // (2+3+4)/3
      expect(result[4]).toBe(4); // (3+4+5)/3
      expect(result[5]).toBe(5); // (4+5+6)/3
    });

    test('handles known reference values', () => {
      // Known test case from financial calculators
      const prices = [22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29];
      const result = calculateSMA(prices, 5);
      
      expect(result[4]).toBeCloseTo(22.178, 2);
      expect(result[9]).toBeCloseTo(22.264, 2);
    });

    test('returns empty array for empty data', () => {
      expect(calculateSMA([], 5)).toEqual([]);
    });

    test('throws error for invalid period', () => {
      expect(() => calculateSMA([1, 2, 3], 0)).toThrow();
      expect(() => calculateSMA([1, 2, 3], -1)).toThrow();
    });
  });

  describe('EMA (Exponential Moving Average)', () => {
    test('calculates EMA correctly', () => {
      const data = [22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29];
      const result = calculateEMA(data, 5);
      
      // First EMA point should equal SMA
      expect(result[4]).toBeCloseTo(22.178, 2);
      
      // Subsequent points use exponential smoothing
      // Multiplier = 2/(5+1) = 0.333...
      expect(result[5]).toBeCloseTo(22.161, 2);
      expect(result[9]).toBeCloseTo(22.268, 2);
    });

    test('returns null for insufficient data', () => {
      const data = [1, 2, 3];
      const result = calculateEMA(data, 5);
      
      expect(result).toHaveLength(3);
      result.forEach(val => expect(val).toBeNull());
    });
  });

  describe('RSI (Relative Strength Index)', () => {
    test('calculates RSI correctly with known values', () => {
      // Known test case - 14-period RSI
      const prices = [
        44.34, 44.09, 43.61, 44.33, 44.83,
        45.10, 45.42, 45.84, 46.08, 45.89,
        46.03, 45.61, 46.28, 46.28, 46.00,
        46.03, 46.41, 46.22, 45.64, 46.21
      ];
      
      const result = calculateRSI(prices, 14);
      
      // RSI should be null for first 14 periods
      for (let i = 0; i < 14; i++) {
        expect(result[i]).toBeNull();
      }
      
      // Check known RSI values (approximate)
      expect(result[14]).toBeCloseTo(66.7, 0);
      expect(result[19]).toBeCloseTo(63.3, 0);
    });

    test('handles edge cases', () => {
      // All prices the same = RSI should be 50 (or NaN handled as special case)
      const flatPrices = Array(20).fill(100);
      const result = calculateRSI(flatPrices, 14);
      
      // After calculation, RSI should be defined
      expect(result[14]).toBeDefined();
    });

    test('returns empty for insufficient data', () => {
      const data = [1, 2, 3];
      const result = calculateRSI(data, 14);
      
      expect(result).toEqual([]);
    });
  });

  describe('MACD', () => {
    test('calculates MACD with default parameters', () => {
      const prices = [
        22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29,
        22.15, 22.39, 22.38, 22.61, 23.36, 24.05, 23.75, 23.83, 23.95, 23.63,
        23.82, 23.87, 23.65, 23.19, 23.10, 23.33, 22.68, 23.10, 22.40, 22.17
      ];
      
      const result = calculateMACD(prices, 12, 26, 9);
      
      expect(result.macd).toHaveLength(prices.length);
      expect(result.signal).toHaveLength(prices.length);
      expect(result.histogram).toHaveLength(prices.length);
      
      // Early values should be null
      expect(result.macd[0]).toBeNull();
      expect(result.signal[0]).toBeNull();
      expect(result.histogram[0]).toBeNull();
      
      // Later values should be calculated
      // MACD line becomes valid after slowPeriod (26)
      // Signal line becomes valid after slowPeriod + signalPeriod (26+9=35)
      // But we only have 30 data points, so signal and histogram will all be null
      // Just check that MACD line itself has values
      expect(result.macd[prices.length - 1]).not.toBeNull();
    });

    test('histogram equals MACD minus signal', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);
      const result = calculateMACD(prices, 12, 26, 9);
      
      for (let i = 0; i < prices.length; i++) {
        if (result.macd[i] !== null && result.signal[i] !== null) {
          expect(result.histogram[i]).toBeCloseTo(
            result.macd[i] - result.signal[i],
            10
          );
        }
      }
    });
  });

  describe('Bollinger Bands', () => {
    test('calculates Bollinger Bands correctly', () => {
      const prices = [
        22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29,
        22.15, 22.39, 22.38, 22.61, 23.36, 24.05, 23.75, 23.83, 23.95, 23.63,
        23.82, 23.87, 23.65, 23.19, 23.10
      ];
      
      const result = calculateBollingerBands(prices, 20, 2);
      
      expect(result.upper).toHaveLength(prices.length);
      expect(result.middle).toHaveLength(prices.length);
      expect(result.lower).toHaveLength(prices.length);
      
      // First 19 values should be null
      for (let i = 0; i < 19; i++) {
        expect(result.upper[i]).toBeNull();
        expect(result.middle[i]).toBeNull();
        expect(result.lower[i]).toBeNull();
      }
      
      // Check that bands make sense: upper > middle > lower
      for (let i = 19; i < prices.length; i++) {
        expect(result.upper[i]).toBeGreaterThan(result.middle[i]);
        expect(result.middle[i]).toBeGreaterThan(result.lower[i]);
      }
      
      // Middle band should equal 20-period SMA
      const sma20 = calculateSMA(prices, 20);
      for (let i = 19; i < prices.length; i++) {
        expect(result.middle[i]).toBeCloseTo(sma20[i], 10);
      }
    });

    test('bands are symmetric around middle', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5);
      const result = calculateBollingerBands(prices, 20, 2);
      
      for (let i = 19; i < prices.length; i++) {
        const upperDist = result.upper[i] - result.middle[i];
        const lowerDist = result.middle[i] - result.lower[i];
        expect(upperDist).toBeCloseTo(lowerDist, 10);
      }
    });
  });

  describe('Edge cases and validation', () => {
    test('handles single data point', () => {
      const data = [100];
      
      expect(calculateSMA(data, 1)).toEqual([100]);
      expect(calculateEMA(data, 1)).toEqual([100]);
    });

    test('handles null or undefined gracefully', () => {
      expect(calculateSMA(null, 5)).toEqual([]);
      expect(calculateEMA(undefined, 5)).toEqual([]);
    });
  });
});
