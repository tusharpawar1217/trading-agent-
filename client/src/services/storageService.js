/**
 * Local Storage Service
 * 
 * Manages localStorage for signal history and paper positions.
 * Data model is designed for easy migration to SQLite later.
 */

const STORAGE_KEYS = {
  SIGNALS: 'fx_desk_signals',
  POSITIONS: 'fx_desk_positions',
  SETTINGS: 'fx_desk_settings'
};

/**
 * Save a signal to history (approved or dismissed)
 */
export function saveSignal(signal, action, position = null) {
  const signals = getAllSignals();
  
  const entry = {
    id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    signal,
    action, // 'approved' or 'dismissed'
    position: position ? position.id : null,
    timestamp: new Date().toISOString()
  };
  
  signals.push(entry);
  localStorage.setItem(STORAGE_KEYS.SIGNALS, JSON.stringify(signals));
  
  return entry;
}

/**
 * Get all signal history
 */
export function getAllSignals() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SIGNALS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading signals from localStorage:', error);
    return [];
  }
}

/**
 * Save a position (open or closed)
 */
export function savePosition(position) {
  const positions = getAllPositions();
  
  // Update existing or add new
  const existingIndex = positions.findIndex(p => p.id === position.id);
  if (existingIndex >= 0) {
    positions[existingIndex] = position;
  } else {
    positions.push(position);
  }
  
  localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify(positions));
  
  return position;
}

/**
 * Get all positions
 */
export function getAllPositions() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.POSITIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading positions from localStorage:', error);
    return [];
  }
}

/**
 * Get open positions only
 */
export function getOpenPositions() {
  return getAllPositions().filter(p => p.status === 'open');
}

/**
 * Get closed positions only
 */
export function getClosedPositions() {
  return getAllPositions().filter(p => p.status === 'closed');
}

/**
 * Delete a position (for testing/cleanup only)
 */
export function deletePosition(positionId) {
  const positions = getAllPositions().filter(p => p.id !== positionId);
  localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify(positions));
}

/**
 * Clear all data (use with caution!)
 */
export function clearAllData() {
  localStorage.removeItem(STORAGE_KEYS.SIGNALS);
  localStorage.removeItem(STORAGE_KEYS.POSITIONS);
}

/**
 * Export data for backup/analysis
 */
export function exportData() {
  return {
    signals: getAllSignals(),
    positions: getAllPositions(),
    exportedAt: new Date().toISOString()
  };
}

/**
 * Import data from backup
 */
export function importData(data) {
  if (data.signals) {
    localStorage.setItem(STORAGE_KEYS.SIGNALS, JSON.stringify(data.signals));
  }
  if (data.positions) {
    localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify(data.positions));
  }
}
