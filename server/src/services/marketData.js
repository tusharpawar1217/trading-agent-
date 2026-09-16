import fetch from 'node-fetch';

/**
 * Market Data Service
 * 
 * Currently uses Frankfurter API (European Central Bank data).
 * This is a free, no-key-required source for daily forex rates.
 * 
 * TO SWAP PROVIDERS:
 * Replace the implementation of getHistoricalRates() below while
 * maintaining the same return shape:
 * {
 *   pair: string,
 *   data: Array<{ date: string, open: number, high: number, low: number, close: number }>
 * }
 * 
 * Alternative providers for intraday data:
 * - OANDA v20 API (retail forex, real-time)
 * - Alpha Vantage (free tier with API key)
 * - Twelve Data (forex + stocks)
 * - Your broker's API
 */

const FRANKFURTER_BASE_URL = 'https://api.frankfurter.app';

/**
 * Fetch historical exchange rates for a currency pair
 * @param {string} pair - Currency pair (e.g., "EUR/USD")
 * @param {number} days - Number of days of history
 * @returns {Promise<{pair: string, data: Array}>}
 */
export async function getHistoricalRates(pair, days = 90) {
  // Parse the currency pair
  const [base, quote] = pair.split('/').map(c => c.trim().toUpperCase());
  
  if (!base || !quote) {
    throw new Error('Invalid currency pair format. Use "BASE/QUOTE" (e.g., "EUR/USD")');
  }

  // Frankfurter only supports EUR as base, so we need to handle conversions
  if (base !== 'EUR') {
    throw new Error('Frankfurter API only supports EUR as base currency. Try EUR/USD, EUR/GBP, etc.');
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  const url = `${FRANKFURTER_BASE_URL}/${startStr}..${endStr}?to=${quote}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Frankfurter API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  
  // Transform Frankfurter data into OHLC format
  // Note: Frankfurter only provides daily close rates, so O=H=L=C
  const data = Object.entries(json.rates).map(([date, rates]) => {
    const close = rates[quote];
    return {
      date,
      open: close,   // Daily data: open = close from previous day
      high: close,   // No intraday high available
      low: close,    // No intraday low available
      close: close,
    };
  });

  // Sort by date ascending
  data.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Simulate realistic open/high/low by adding small variations
  // This is ONLY for visual purposes in development
  // Real data from an intraday provider would have actual OHLC values
  for (let i = 0; i < data.length; i++) {
    const volatility = 0.002; // 0.2% typical intraday variation
    const close = data[i].close;
    
    data[i].open = close * (1 + (Math.random() - 0.5) * volatility);
    data[i].high = close * (1 + Math.random() * volatility);
    data[i].low = close * (1 - Math.random() * volatility);
    
    // Ensure high >= close >= low
    data[i].high = Math.max(data[i].high, data[i].close, data[i].open);
    data[i].low = Math.min(data[i].low, data[i].close, data[i].open);
  }

  return {
    pair: `${base}/${quote}`,
    base,
    quote,
    source: 'Frankfurter (ECB)',
    data,
  };
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}
