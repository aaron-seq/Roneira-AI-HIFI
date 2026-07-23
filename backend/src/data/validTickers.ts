/**
 * Ticker validation & whitelist
 *
 * Prevents arbitrary/garbage strings from being forwarded to the ML service
 * and external financial data APIs (Alpha Vantage). Two layers:
 *
 * 1. Format validation - shape of a real exchange ticker.
 * 2. Whitelist - the curated set of symbols this deployment actively
 *    supports. Unknown-but-well-formed tickers are rejected with a clear
 *    error rather than silently forwarded, and the attempt is logged so
 *    repeated probing is visible.
 *
 * To support a new symbol, add it to KNOWN_TICKERS below.
 */

// US equities (S&P 500 / Nasdaq-100 heavy hitters + common ETFs)
const US_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META', 'NVDA', 'AMD', 'INTC',
  'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'C',
  'JNJ', 'PFE', 'UNH', 'MRK', 'ABBV', 'LLY',
  'XOM', 'CVX', 'COP',
  'WMT', 'COST', 'TGT', 'HD', 'LOW', 'NKE', 'MCD', 'SBUX', 'DIS',
  'KO', 'PEP', 'PG', 'CL',
  'NFLX', 'ADBE', 'CRM', 'ORCL', 'IBM', 'CSCO', 'AVGO', 'QCOM', 'TXN', 'UBER', 'ABNB',
  'BA', 'CAT', 'GE', 'HON', 'UPS', 'FDX',
  'SPY', 'DIA', 'QQQ', 'IWM', 'VTI', 'VOO',
];

// NSE/BSE (Indian equities, PDM strategy universe) — see pdm_strategy_engine.py
const INDIAN_TICKERS = [
  'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'HINDUNILVR.NS', 'ITC.NS',
  'SBIN.NS', 'BHARTIARTL.NS', 'ASIANPAINT.NS', 'MARUTI.NS', 'KOTAKBANK.NS', 'LT.NS',
  'AXISBANK.NS', 'NESTLEIND.NS', 'WIPRO.NS', 'ULTRACEMCO.NS', 'BAJFINANCE.NS',
  'HCLTECH.NS', 'SUNPHARMA.NS', 'ONGC.NS',
];

// Market index symbols used by PDM backtesting
const INDEX_TICKERS = ['^NSEI', '^GSPC', '^IXIC', '^DJI'];

export const KNOWN_TICKERS: ReadonlySet<string> = new Set([
  ...US_TICKERS,
  ...INDIAN_TICKERS,
  ...INDEX_TICKERS,
]);

// US/Indian exchange ticker shape: 1-6 letters, optional single '.' + 1-3
// letter suffix (e.g. RELIANCE.NS), or an index symbol prefixed with '^'.
const TICKER_FORMAT = /^(\^[A-Z]{2,10}|[A-Z]{1,6}(\.[A-Z]{1,3})?)$/;

export interface TickerValidationResult {
  valid: boolean;
  normalized: string;
  reason?: string;
}

/**
 * Validate a ticker symbol against both format and whitelist rules.
 * Always normalizes to uppercase/trimmed before checking.
 */
export function validateTicker(rawTicker: string): TickerValidationResult {
  const normalized = (rawTicker || '').trim().toUpperCase();

  if (!normalized) {
    return { valid: false, normalized, reason: 'Ticker symbol is required' };
  }

  if (!TICKER_FORMAT.test(normalized)) {
    return { valid: false, normalized, reason: `'${normalized}' is not a valid ticker format` };
  }

  if (!KNOWN_TICKERS.has(normalized)) {
    return { valid: false, normalized, reason: `'${normalized}' is not a supported ticker` };
  }

  return { valid: true, normalized };
}

export function isKnownTicker(ticker: string): boolean {
  return KNOWN_TICKERS.has((ticker || '').trim().toUpperCase());
}
