/**
 * Intraday Signal API Routes
 * 
 * Endpoints for intraday multi-timeframe signal generation
 */

import express, { Request, Response } from 'express';
import { generateIntradaySignal, formatIntradaySignal } from '../core/strategy/intradaySignals.js';
import { getHistoricalRates } from '../services/marketData.js';
import { riskManager } from '../core/risk/index.js';

const router = express.Router();

/**
 * POST /api/intraday-signals/generate
 * 
 * Generate intraday signal with multi-timeframe analysis
 * 
 * Body: {
 *   pair: string,
 *   days?: number (default: 7 for intraday)
 * }
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { pair, days = 7 } = req.body;
    
    if (!pair) {
      return res.status(400).json({ error: 'Currency pair is required' });
    }
    
    console.log(`📊 Generating intraday signal for ${pair}...`);
    
    // Fetch market data (need enough for H1 conversion)
    const marketData = await getHistoricalRates(pair, days);
    
    if (!marketData.data || marketData.data.length < 200) {
      return res.status(400).json({
        error: 'Insufficient data',
        message: `Need at least 200 candles for intraday analysis. Got: ${marketData.data?.length || 0}`,
      });
    }
    
    // Convert to OHLC format
    const candles = marketData.data.map((d: any) => ({
      timestamp: new Date(d.date).getTime(),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 0,
    }));
    
    // Generate signal
    const signal = generateIntradaySignal(candles, pair);
    
    if (!signal) {
      return res.json({
        signal: null,
        message: 'No signal: Timeframes not aligned or insufficient momentum',
        alignment: {
          note: 'Waiting for H1, M15, and M5 to agree on direction',
        },
      });
    }
    
    // Check circuit breakers
    const riskCheck = await riskManager.checkAll({
      pair,
      signal,
      timestamp: Date.now(),
    });
    
    if (!riskCheck.allowed) {
      return res.status(403).json({
        signal: {
          ...signal,
          blocked: true,
        },
        riskStatus: {
          allowed: false,
          reason: riskCheck.reason,
          trippedBreakers: riskManager.getTrippedBreakers(),
        },
        warning: '⚠️ Signal blocked by risk management system',
      });
    }
    
    // Return signal
    res.json({
      signal,
      formatted: formatIntradaySignal(signal),
      riskStatus: {
        allowed: true,
      },
      generatedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error generating intraday signal:', error);
    res.status(500).json({
      error: 'Failed to generate intraday signal',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/intraday-signals/timeframes/:pair
 * 
 * Get current timeframe data for visualization
 * 
 * Returns H1, M15, M5 candles for chart display
 */
router.get('/timeframes/:pair', async (req: Request, res: Response) => {
  try {
    const { pair } = req.params;
    const { days = 7 } = req.query;
    
    console.log(`📈 Fetching timeframe data for ${pair}...`);
    
    // Fetch market data
    const marketData = await getHistoricalRates(pair, parseInt(days as string, 10));
    
    if (!marketData.data || marketData.data.length === 0) {
      return res.status(404).json({
        error: 'No data available',
      });
    }
    
    // Convert to OHLC
    const candles = marketData.data.map((d: any) => ({
      timestamp: new Date(d.date).getTime(),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 0,
    }));
    
    // Import converter
    const { convertToTimeframe } = await import('../core/strategy/timeframeConverter.js');
    const { Timeframe } = await import('../../../shared/types/market.js');
    
    // Convert to all timeframes
    const h1Candles = convertToTimeframe(candles, Timeframe.H1);
    const m15Candles = convertToTimeframe(candles, Timeframe.M15);
    const m5Candles = convertToTimeframe(candles, Timeframe.M5);
    
    res.json({
      pair,
      timeframes: {
        H1: {
          timeframe: 'H1',
          candles: h1Candles.slice(-100), // Last 100 candles
          description: '1-hour candles (directional bias)',
        },
        M15: {
          timeframe: 'M15',
          candles: m15Candles.slice(-100),
          description: '15-minute candles (structure confirmation)',
        },
        M5: {
          timeframe: 'M5',
          candles: m5Candles.slice(-100),
          description: '5-minute candles (entry timing)',
        },
      },
      generatedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error fetching timeframe data:', error);
    res.status(500).json({
      error: 'Failed to fetch timeframe data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
