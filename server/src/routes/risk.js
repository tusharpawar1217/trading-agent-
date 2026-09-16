/**
 * Risk Management API Endpoints (JavaScript bridge)
 * 
 * This file will be replaced when we fully migrate to TypeScript.
 * For now, it provides the same functionality.
 */

import express from 'express';
import { riskManager } from '../core/risk/RiskManager.js';

const router = express.Router();

/**
 * GET /api/risk/status
 */
router.get('/status', async (req, res) => {
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
      error: error.message,
    });
  }
});

/**
 * POST /api/risk/reset/:name
 */
router.post('/reset/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      res.status(400).json({
        success: false,
        error: 'Reset reason is required',
      });
      return;
    }
    
    riskManager.reset(name);
    
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
      error: error.message,
    });
  }
});

/**
 * POST /api/risk/reset-all
 */
router.post('/reset-all', async (req, res) => {
  try {
    const { reason, confirm } = req.body;
    
    if (!reason) {
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
      error: error.message,
    });
  }
});

/**
 * GET /api/risk/health
 */
router.get('/health', async (req, res) => {
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
      error: error.message,
    });
  }
});

export default router;
