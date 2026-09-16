/**
 * Intraday Signal API Routes (JavaScript bridge)
 */

import express from 'express';
import { getHistoricalRates } from '../services/marketData.js';
import { riskManager } from '../core/risk/index.js';

const router = express.Router();

// Mock implementation until TypeScript compilation works
router.post('/generate', async (req, res) => {
  try {
    const { pair, days = 7 } = req.body;
    
    if (!pair) {
      return res.status(400).json({ error: 'Currency pair is required' });
    }
    
    res.json({
      signal: null,
      message: 'Intraday signal generation coming soon. TypeScript compilation in progress.',
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/timeframes/:pair', async (req, res) => {
  try {
    const { pair } = req.params;
    const { days = 7 } = req.query;
    
    const marketData = await getHistoricalRates(pair, parseInt(days, 10));
    
    if (!marketData.data || marketData.data.length === 0) {
      return res.status(404).json({ error: 'No data available' });
    }
    
    // Convert to OHLC
    const candles = marketData.data.map(d => ({
      timestamp: new Date(d.date).getTime(),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 0,
    }));
    
    // For now, return same candles for all timeframes
    // (Will be replaced with proper conversion when TS compiles)
    res.json({
      pair,
      timeframes: {
        H1: {
          timeframe: 'H1',
          candles: candles.slice(-100),
          description: '1-hour candles (directional bias)',
        },
        M15: {
          timeframe: 'M15',
          candles: candles.slice(-100),
          description: '15-minute candles (structure confirmation)',
        },
        M5: {
          timeframe: 'M5',
          candles: candles.slice(-100),
          description: '5-minute candles (entry timing)',
        },
      },
      generatedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
