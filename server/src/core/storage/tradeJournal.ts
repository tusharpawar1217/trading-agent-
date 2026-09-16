/**
 * Trade Journal — Local Storage with P&L Tracking
 * 
 * STORES:
 * - All trades (entry/exit, P&L, fees)
 * - Signal decisions (approved/rejected/dismissed)
 * - Post-trade analysis (manual notes + LLM rationale)
 * - Performance snapshots (daily equity curve)
 * 
 * WHY LOCAL STORAGE:
 * This is a local-first application. Your trading data stays on your machine.
 * No cloud sync, no third-party database, no data leakage.
 * 
 * STORAGE FORMAT:
 * JSON files in `data/` directory:
 * - trades.json: All closed trades
 * - signals.json: Signal generation history
 * - equity.json: Daily equity snapshots
 * - notes.json: Post-trade analysis notes
 */

import fs from 'fs/promises';
import path from 'path';
import { Trade } from '../analytics/performanceMetrics';

const DATA_DIR = path.join(process.cwd(), 'data');

export interface StoredTrade extends Trade {
  // Additional journal fields
  signalId?: string; // Link to signal that generated this trade
  notes?: string; // Manual trader notes
  llmRationale?: string; // LLM post-trade analysis
  tags?: string[]; // User-defined tags (e.g., "news-trade", "breakout")
  screenshot?: string; // Path to chart screenshot
  reviewedAt?: number; // Timestamp of manual review
}

export interface SignalRecord {
  id: string;
  timestamp: number;
  pair: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  verdict: 'approved' | 'rejected' | 'dismissed' | 'blocked';
  blockReason?: string; // If blocked by circuit breaker
  suggestedLevels?: {
    entry: number;
    stopLoss: number;
    takeProfit: number;
    riskReward: number;
  };
  indicators?: any; // Snapshot of indicator values
  llmCommentary?: string;
  tradeId?: string; // Link to trade if approved
}

export interface EquitySnapshot {
  timestamp: number;
  date: string; // YYYY-MM-DD
  equity: number;
  dayPnL: number;
  dayPnLPct: number;
  openPositions: number;
  closedTradesToday: number;
}

export interface PostTradeNote {
  tradeId: string;
  createdAt: number;
  updatedAt: number;
  manualNotes: string;
  llmRationale?: string;
  lessonsLearned?: string[];
  mistakes?: string[];
  whatWorked?: string[];
  whatDidnt?: string[];
}

/**
 * Initialize data directory
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create data directory:', error);
  }
}

/**
 * Load JSON file
 */
async function loadJSON<T>(filename: string): Promise<T[]> {
  try {
    await ensureDataDir();
    const filepath = path.join(DATA_DIR, filename);
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet
      return [];
    }
    console.error(`Failed to load ${filename}:`, error);
    return [];
  }
}

/**
 * Save JSON file
 */
async function saveJSON<T>(filename: string, data: T[]): Promise<void> {
  try {
    await ensureDataDir();
    const filepath = path.join(DATA_DIR, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Failed to save ${filename}:`, error);
    throw error;
  }
}

/**
 * Save a trade to the journal
 */
export async function saveTrade(trade: StoredTrade): Promise<void> {
  const trades = await loadJSON<StoredTrade>('trades.json');
  
  // Check if trade already exists (update if yes)
  const existingIndex = trades.findIndex(t => t.id === trade.id);
  
  if (existingIndex >= 0) {
    trades[existingIndex] = trade;
    console.log(`📝 Updated trade: ${trade.id}`);
  } else {
    trades.push(trade);
    console.log(`📝 Saved new trade: ${trade.id} (${trade.direction} ${trade.pair}, P&L: $${trade.pnl.toFixed(2)})`);
  }
  
  await saveJSON('trades.json', trades);
}

/**
 * Load all trades
 */
export async function loadTrades(): Promise<StoredTrade[]> {
  return await loadJSON<StoredTrade>('trades.json');
}

/**
 * Get trades within date range
 */
export async function getTradesInRange(
  startTime: number,
  endTime: number
): Promise<StoredTrade[]> {
  const trades = await loadTrades();
  return trades.filter(t => 
    t.exitTime >= startTime && t.exitTime <= endTime
  );
}

/**
 * Get trades by pair
 */
export async function getTradesByPair(pair: string): Promise<StoredTrade[]> {
  const trades = await loadTrades();
  return trades.filter(t => t.pair === pair);
}

/**
 * Save signal decision
 */
export async function saveSignal(signal: SignalRecord): Promise<void> {
  const signals = await loadJSON<SignalRecord>('signals.json');
  
  const existingIndex = signals.findIndex(s => s.id === signal.id);
  
  if (existingIndex >= 0) {
    signals[existingIndex] = signal;
  } else {
    signals.push(signal);
  }
  
  await saveJSON('signals.json', signals);
  console.log(`📊 Saved signal: ${signal.id} (${signal.verdict})`);
}

/**
 * Load all signals
 */
export async function loadSignals(): Promise<SignalRecord[]> {
  return await loadJSON<SignalRecord>('signals.json');
}

/**
 * Save daily equity snapshot
 */
export async function saveEquitySnapshot(snapshot: EquitySnapshot): Promise<void> {
  const snapshots = await loadJSON<EquitySnapshot>('equity.json');
  
  // Remove any existing snapshot for this date
  const filtered = snapshots.filter(s => s.date !== snapshot.date);
  filtered.push(snapshot);
  
  // Sort by date
  filtered.sort((a, b) => a.timestamp - b.timestamp);
  
  await saveJSON('equity.json', filtered);
  console.log(`📈 Saved equity snapshot: ${snapshot.date} ($${snapshot.equity.toFixed(2)})`);
}

/**
 * Load equity curve
 */
export async function loadEquityCurve(): Promise<EquitySnapshot[]> {
  return await loadJSON<EquitySnapshot>('equity.json');
}

/**
 * Get latest equity snapshot
 */
export async function getLatestEquity(): Promise<EquitySnapshot | null> {
  const snapshots = await loadEquityCurve();
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

/**
 * Save post-trade note
 */
export async function savePostTradeNote(note: PostTradeNote): Promise<void> {
  const notes = await loadJSON<PostTradeNote>('notes.json');
  
  const existingIndex = notes.findIndex(n => n.tradeId === note.tradeId);
  
  if (existingIndex >= 0) {
    notes[existingIndex] = { ...notes[existingIndex], ...note, updatedAt: Date.now() };
  } else {
    notes.push(note);
  }
  
  await saveJSON('notes.json', notes);
  console.log(`📓 Saved post-trade note for: ${note.tradeId}`);
}

/**
 * Load post-trade notes
 */
export async function loadPostTradeNotes(): Promise<PostTradeNote[]> {
  return await loadJSON<PostTradeNote>('notes.json');
}

/**
 * Get note for specific trade
 */
export async function getPostTradeNote(tradeId: string): Promise<PostTradeNote | null> {
  const notes = await loadPostTradeNotes();
  return notes.find(n => n.tradeId === tradeId) || null;
}

/**
 * Calculate current equity from trade history
 */
export async function calculateCurrentEquity(startingEquity: number = 10000): Promise<number> {
  const trades = await loadTrades();
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl - t.commission, 0);
  return startingEquity + totalPnL;
}

/**
 * Get trades needing review (no manual notes yet)
 */
export async function getTradesNeedingReview(): Promise<StoredTrade[]> {
  const trades = await loadTrades();
  const notes = await loadPostTradeNotes();
  const reviewedTradeIds = new Set(notes.map(n => n.tradeId));
  
  return trades
    .filter(t => !reviewedTradeIds.has(t.id))
    .sort((a, b) => b.exitTime - a.exitTime); // Most recent first
}

/**
 * Export trades to CSV
 */
export async function exportTradesToCSV(filepath: string): Promise<void> {
  const trades = await loadTrades();
  
  if (trades.length === 0) {
    throw new Error('No trades to export');
  }
  
  // CSV header
  const headers = [
    'ID', 'Entry Time', 'Exit Time', 'Pair', 'Direction', 'Size',
    'Entry Price', 'Exit Price', 'Stop Loss', 'Take Profit',
    'P&L', 'P&L %', 'Commission', 'Exit Reason', 'Hold Time (s)', 'Notes'
  ];
  
  // CSV rows
  const rows = trades.map(t => [
    t.id,
    new Date(t.entryTime).toISOString(),
    new Date(t.exitTime).toISOString(),
    t.pair,
    t.direction,
    t.size,
    t.entryPrice,
    t.exitPrice,
    t.stopLoss || '',
    t.takeProfit || '',
    t.pnl.toFixed(2),
    t.pnlPct.toFixed(4),
    t.commission.toFixed(2),
    t.exitReason || '',
    (t.exitTime - t.entryTime) / 1000,
    t.notes || ''
  ]);
  
  // Combine
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  await fs.writeFile(filepath, csv, 'utf-8');
  console.log(`📄 Exported ${trades.length} trades to: ${filepath}`);
}

/**
 * Get statistics summary
 */
export async function getJournalStats(): Promise<{
  totalTrades: number;
  totalSignals: number;
  signalsApproved: number;
  signalsRejected: number;
  signalsDismissed: number;
  signalsBlocked: number;
  tradesNeedingReview: number;
  oldestTrade: number | null;
  newestTrade: number | null;
}> {
  const trades = await loadTrades();
  const signals = await loadSignals();
  const needingReview = await getTradesNeedingReview();
  
  return {
    totalTrades: trades.length,
    totalSignals: signals.length,
    signalsApproved: signals.filter(s => s.verdict === 'approved').length,
    signalsRejected: signals.filter(s => s.verdict === 'rejected').length,
    signalsDismissed: signals.filter(s => s.verdict === 'dismissed').length,
    signalsBlocked: signals.filter(s => s.verdict === 'blocked').length,
    tradesNeedingReview: needingReview.length,
    oldestTrade: trades.length > 0 ? Math.min(...trades.map(t => t.entryTime)) : null,
    newestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.exitTime)) : null,
  };
}

/**
 * Example usage:
 * 
 * // Save a completed trade
 * await saveTrade({
 *   id: 'trade-001',
 *   entryTime: Date.now() - 3600000,
 *   exitTime: Date.now(),
 *   entryPrice: 1.1234,
 *   exitPrice: 1.1284,
 *   direction: 'BUY',
 *   size: 0.1,
 *   pnl: 50,
 *   pnlPct: 0.5,
 *   commission: 2,
 *   pair: 'EUR/USD',
 *   stopLoss: 1.1184,
 *   takeProfit: 1.1334,
 *   exitReason: 'TAKE_PROFIT',
 *   signalId: 'signal-123',
 * });
 * 
 * // Add post-trade analysis
 * await savePostTradeNote({
 *   tradeId: 'trade-001',
 *   createdAt: Date.now(),
 *   updatedAt: Date.now(),
 *   manualNotes: 'Clean breakout trade. Entry was precise.',
 *   whatWorked: ['Waited for confirmation', 'Respected stop loss'],
 *   mistakes: ['Could have held longer for 3R'],
 * });
 * 
 * // Load all trades and calculate metrics
 * const trades = await loadTrades();
 * const metrics = calculatePerformanceMetrics(trades);
 * console.log(`Win rate: ${metrics.winRate.toFixed(1)}%`);
 * console.log(`Expectancy: $${metrics.expectancy.toFixed(2)} per trade`);
 */
