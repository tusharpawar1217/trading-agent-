import express from 'express';
import { getHistoricalRates } from '../services/marketData.js';

const router = express.Router();

/**
 * GET /api/market-data/historical
 * Query params:
 *   - pair: currency pair (e.g., "EUR/USD")
 *   - days: number of days of history (default: 90)
 */
router.get('/historical', async (req, res) => {
  try {
    const { pair, days = 90 } = req.query;
    
    if (!pair) {
      return res.status(400).json({ error: 'Currency pair is required' });
    }

    const data = await getHistoricalRates(pair, parseInt(days, 10));
    res.json(data);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch market data',
      message: error.message 
    });
  }
});

/**
 * GET /api/market-data/pairs
 * Returns list of available currency pairs
 */
router.get('/pairs', (req, res) => {
  // Common forex pairs - Frankfurter uses EUR as base
  const pairs = [
    { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
    { symbol: 'EUR/GBP', name: 'Euro / British Pound' },
    { symbol: 'EUR/JPY', name: 'Euro / Japanese Yen' },
    { symbol: 'EUR/CHF', name: 'Euro / Swiss Franc' },
    { symbol: 'EUR/AUD', name: 'Euro / Australian Dollar' },
    { symbol: 'EUR/CAD', name: 'Euro / Canadian Dollar' },
    { symbol: 'EUR/NZD', name: 'Euro / New Zealand Dollar' },
  ];
  
  res.json(pairs);
});

export default router;
