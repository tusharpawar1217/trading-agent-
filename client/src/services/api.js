/**
 * API Service
 * All communication with the backend server
 */

const API_BASE_URL = '/api';

/**
 * Fetch available currency pairs
 */
export async function fetchAvailablePairs() {
  const response = await fetch(`${API_BASE_URL}/market-data/pairs`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch historical market data for a currency pair
 * @param {string} pair - Currency pair (e.g., "EUR/USD")
 * @param {number} days - Number of days of history
 */
export async function fetchHistoricalData(pair, days = 90) {
  const response = await fetch(
    `${API_BASE_URL}/market-data/historical?pair=${encodeURIComponent(pair)}&days=${days}`
  );
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Generate trading signal for a currency pair
 * @param {string} pair - Currency pair (e.g., "EUR/USD")
 * @param {boolean} includeLLM - Whether to generate LLM commentary
 */
export async function generateSignal(pair, includeLLM = false) {
  const response = await fetch(`${API_BASE_URL}/signals/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pair, includeLLM })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}
