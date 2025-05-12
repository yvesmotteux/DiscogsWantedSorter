let DISCOGS_TOKEN = process.env.DISCOGS_TOKEN || '';

const MAX_REQUESTS_PER_MINUTE = 60;
const REQUEST_INTERVAL_MS = 60 * 1000 / MAX_REQUESTS_PER_MINUTE; // ~1000ms between requests

const DEFAULT_CURRENCY = 'EUR';
const CURRENCY_SYMBOLS = {
  'EUR': '€',
  'USD': '$',
  'GBP': '£',
  'JPY': '¥',
  'CAD': 'CA$',
  'AUD': 'AU$'
};

const DEFAULT_CONDITION = 'Very Good (VG)';

module.exports = {
  getDiscogsToken: () => DISCOGS_TOKEN,
  setDiscogsToken: (token) => { DISCOGS_TOKEN = token; },
  MAX_REQUESTS_PER_MINUTE,
  REQUEST_INTERVAL_MS,
  MAX_SAFE_REQUESTS_PER_MINUTE: 59, // stay just under the limit to be safe
  DEFAULT_CURRENCY,
  CURRENCY_SYMBOLS,
  getCurrencySymbol: (currencyCode) => CURRENCY_SYMBOLS[currencyCode] || CURRENCY_SYMBOLS[DEFAULT_CURRENCY],
  DEFAULT_CONDITION
};