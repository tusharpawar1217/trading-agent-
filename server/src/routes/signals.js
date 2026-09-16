import express from 'express';
import { computeSignal, calculateStopLoss, calculateTakeProfit } from '../utils/signalScorer.js';
import { getHistoricalRates } from '../services/marketData.js';
import { generateCommentary } from '../services/llmService.js';
import { riskManager } from '../core/risk/index.js';

const router = express.Router();

/**
 * POST /api/signals/generate
 * Generate trading signal for a currency pair
 * Body: { pair: string, days?: number, includeLLM?: boolean }
 */
router.post('/generate', async (req, res) => {
  try {
    const { pair, days = 90, includeLLM = false } = req.body;
    
    if (!pair) {
      return res.status(400).json({ error: 'Currency pair is required' });
    }

    // Fetch market data
    const marketData = await getHistoricalRates(pair, days);
    
    // Compute signal
    const signal = computeSignal(marketData);
    
    // Check circuit breakers BEFORE providing signal
    const riskCheck = await riskManager.checkAll({
      pair,
      signal,
      marketData,
      timestamp: Date.now(),
    });
    
    // If any breaker tripped, return blocked signal
    if (!riskCheck.allowed) {
      return res.status(403).json({
        signal: {
          ...signal,
          verdict: 'BLOCKED',
          riskCheckFailed: true,
        },
        riskStatus: {
          allowed: false,
          reason: riskCheck.reason,
          trippedBreakers: riskManager.getTrippedBreakers(),
        },
        commentary: null,
        generatedAt: new Date().toISOString(),
        warning: '⚠️ Signal blocked by risk management system. Review circuit breaker status before trading.'
      });
    }
    
    // Add suggested SL/TP if verdict is not HOLD
    if (signal.verdict !== 'HOLD') {
      const entryPrice = signal.marketData.currentPrice;
      const stopLoss = calculateStopLoss(entryPrice, signal.verdict);
      const takeProfit = calculateTakeProfit(entryPrice, stopLoss, signal.verdict, 2);
      
      signal.suggestedLevels = {
        entry: entryPrice,
        stopLoss,
        takeProfit,
        riskRewardRatio: 2,
        riskPips: Math.abs(entryPrice - stopLoss) * 10000, // Convert to pips
        rewardPips: Math.abs(entryPrice - takeProfit) * 10000
      };
    }
    
    // Optionally generate LLM commentary
    let commentary = null;
    if (includeLLM && signal.verdict !== 'HOLD') {
      try {
        commentary = await generateCommentary(signal);
      } catch (error) {
        console.error('LLM commentary failed:', error.message);
        // Commentary is optional - don't fail the whole request
        commentary = { 
          error: 'Commentary generation unavailable',
          message: error.message 
        };
      }
    }
    
    res.json({
      signal,
      commentary,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating signal:', error);
    res.status(500).json({ 
      error: 'Failed to generate signal',
      message: error.message 
    });
  }
});

/**
 * POST /api/signals/commentary
 * Generate LLM commentary for an existing signal
 * Body: { signal: Object }
 */
router.post('/commentary', async (req, res) => {
  try {
    const { signal } = req.body;
    
    if (!signal) {
      return res.status(400).json({ error: 'Signal is required' });
    }
    
    const commentary = await generateCommentary(signal);
    
    res.json({
      commentary,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating commentary:', error);
    res.status(500).json({ 
      error: 'Failed to generate commentary',
      message: error.message 
    });
  }
});

export default router;
