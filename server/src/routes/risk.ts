/**
 * Risk Management API Endpoints
 * 
 * Provides HTTP access to circuit breaker status and controls.
 */

import express, { Request, Response } from 'express';
import { riskManager } from '../core/risk/RiskManager';

const router = express.Router();

/**
 * GET /api/risk/status
 * 
 * Returns status of all circuit breakers
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = riskManager.getStatus();
    
    res.json({
      success: true,
      timestamp: Date.now(),
      breakers: status,
      summary: {
        total: status.length,
        tripped: status.filter(b => b.status.tripped).length,
        active: status.filter(b => !b.status.tripped).length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/risk/breaker/:name
 * 
 * Get status of a specific circuit breaker
 */
router.get('/breaker/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const status = riskManager.getStatus();
    
    const breaker = status.find(b => b.name === name);
    
    if (!breaker) {
      res.status(404).json({
        success: false,
        error: `Circuit breaker '${name}' not found`,
      });
      return;
    }
    
    res.json({
      success: true,
      breaker,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/risk/reset/:name
 * 
 * Reset a specific circuit breaker (requires reason)
 * 
 * Body: { reason: string }
 */
router.post('/reset/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { reason } = req.body;
    
    if (!reason || typeof reason !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Reset reason is required',
      });
      return;
    }
    
    riskManager.reset(name);
    
    // Log the reset (in production, save to database)
    console.log(`[RISK] Circuit breaker '${name}' reset. Reason: ${reason}`);
    
    res.json({
      success: true,
      message: `Circuit breaker '${name}' has been reset`,
      reason,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/risk/reset-all
 * 
 * Reset ALL circuit breakers (requires reason and confirmation)
 * 
 * Body: { reason: string, confirm: true }
 */
router.post('/reset-all', async (req: Request, res: Response) => {
  try {
    const { reason, confirm } = req.body;
    
    if (!reason || typeof reason !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Reset reason is required',
      });
      return;
    }
    
    if (confirm !== true) {
      res.status(400).json({
        success: false,
        error: 'Confirmation required (set confirm: true)',
      });
      return;
    }
    
    riskManager.resetAll();
    
    // Log the reset (in production, save to database)
    console.log(`[RISK] ALL circuit breakers reset. Reason: ${reason}`);
    
    res.json({
      success: true,
      message: 'All circuit breakers have been reset',
      reason,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/risk/check
 * 
 * Check if a proposed position passes all circuit breakers
 * 
 * Body: {
 *   pair: string,
 *   direction: 'BUY' | 'SELL',
 *   size: number,
 *   entryPrice: number,
 *   stopLoss: number,
 *   currentEquity: number,
 *   currentSpread: number
 * }
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const {
      pair,
      direction,
      size,
      entryPrice,
      stopLoss,
      currentEquity,
      currentSpread,
    } = req.body;
    
    // Validate required fields
    if (!pair || !direction || !size || !entryPrice || !stopLoss || !currentEquity) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
      return;
    }
    
    const position = {
      id: 'check',
      pair,
      direction,
      size,
      entryPrice,
      stopLoss,
      currentPrice: entryPrice,
      openTime: Date.now(),
      unrealizedPnL: 0,
    };
    
    const results = await riskManager.checkAll(position, currentEquity, currentSpread);
    
    const blocked = results.some(r => !r.allowed);
    
    res.json({
      success: true,
      allowed: !blocked,
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.allowed).length,
        failed: results.filter(r => !r.allowed).length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/risk/health
 * 
 * Simple health check - returns OK if no breakers tripped
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const status = riskManager.getStatus();
    const tripped = status.filter(b => b.status.tripped);
    
    const healthy = tripped.length === 0;
    
    res.status(healthy ? 200 : 503).json({
      success: true,
      healthy,
      tripped: tripped.length,
      breakers: tripped.map(b => ({
        name: b.name,
        type: b.type,
        reason: b.status.reason,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
