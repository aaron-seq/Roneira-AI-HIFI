import axios from 'axios';
import { getCachedData, setCachedData } from './cacheService.js';

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || '';
const BASE_URL = 'https://www.alphavantage.co/query';
const CACHE_TTL = 60; // 60 seconds cache

interface GlobalQuote {
  symbol: string;
  price: string;
  change: string;
  change_percent: string;
  volume: string;
  latest_trading_day: string;
  previous_close: string;
  open: string;
  high: string;
  low: string;
}

interface TimeSeriesData {
  symbol: string;
  data: Array<{
    date: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }>;
}

interface AlphaVantageTimeSeriesValue {
  '1. open': string;
  '2. high': string;
  '3. low': string;
  '4. close': string;
  '5. volume': string;
}

interface MarketIndex {
  name: string;
  value: string;
  change: string;
}

interface TopPerformer {
  ticker: string;
  price: string;
  change: string;
}

interface MarketOverview {
  indices: MarketIndex[];
  topPerformers: TopPerformer[];
  lastUpdated: string;
}

/**
 * Get real-time quote for a stock symbol
 */
export async function getGlobalQuote(symbol: string): Promise<GlobalQuote | null> {
  const cacheKey = `quote:${symbol}`;

  // Check cache first
  const cached = await getCachedData(cacheKey);
  if (cached) {
    return cached as GlobalQuote;
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: symbol,
        apikey: ALPHA_VANTAGE_API_KEY,
      },
      timeout: 5000,
    });

    const quoteData = response.data['Global Quote'];

    if (!quoteData || Object.keys(quoteData).length === 0) {
      console.log(`No data returned for symbol: ${symbol}`);
      return null;
    }

    const quote: GlobalQuote = {
      symbol: quoteData['01. symbol'],
      price: quoteData['05. price'],
      change: quoteData['09. change'],
      change_percent: quoteData['10. change percent'],
      volume: quoteData['06. volume'],
      latest_trading_day: quoteData['07. latest trading day'],
      previous_close: quoteData['08. previous close'],
      open: quoteData['02. open'],
      high: quoteData['03. high'],
      low: quoteData['04. low'],
    };

    // Cache the result
    await setCachedData(cacheKey, quote, CACHE_TTL);

    return quote;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Error fetching quote for ${symbol}:`, error.message);
    } else {
      console.error(`Error fetching quote for ${symbol}:`, String(error));
    }
    return null;
  }
}

/**
 * Get multiple quotes at once
 */
export async function getBatchQuotes(
  symbols: string[]
): Promise<Record<string, GlobalQuote | null>> {
  const results: Record<string, GlobalQuote | null> = {};

  // Alpha Vantage free tier: 5 requests per minute
  // Add delay between requests to avoid rate limiting
  for (const symbol of symbols) {
    results[symbol] = await getGlobalQuote(symbol);
    // 12 second delay = 5 requests per minute
    if (symbols.indexOf(symbol) < symbols.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 12000));
    }
  }

  return results;
}

/**
 * Get daily time series data (last 100 days)
 */
export async function getTimeSeriesDaily(
  symbol: string,
  outputSize: 'compact' | 'full' = 'compact'
): Promise<TimeSeriesData | null> {
  const cacheKey = `timeseries:${symbol}:${outputSize}`;

  // Check cache first (5 minute TTL for time series)
  const cached = await getCachedData(cacheKey);
  if (cached) {
    return cached as TimeSeriesData;
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: symbol,
        outputsize: outputSize,
        apikey: ALPHA_VANTAGE_API_KEY,
      },
      timeout: 10000,
    });

    const timeSeriesData = response.data['Time Series (Daily)'];

    if (!timeSeriesData) {
      console.log(`No time series data for symbol: ${symbol}`);
      return null;
    }

    const data: TimeSeriesData = {
      symbol: symbol,
      data: Object.entries(timeSeriesData).map(([date, values]) => {
        const val = values as AlphaVantageTimeSeriesValue;
        return {
          date,
          open: val['1. open'],
          high: val['2. high'],
          low: val['3. low'],
          close: val['4. close'],
          volume: val['5. volume'],
        };
      }),
    };

    // Cache for 5 minutes
    await setCachedData(cacheKey, data, 300);

    return data;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Error fetching time series for ${symbol}:`, error.message);
    } else {
      console.error(`Error fetching time series for ${symbol}:`, String(error));
    }
    return null;
  }
}

/**
 * Get market overview with major indices and top performers
 */
export async function getMarketOverview(): Promise<MarketOverview> {
  const cacheKey = 'market:overview';

  // Check cache first
  const cached = await getCachedData(cacheKey);
  if (cached) {
    return cached as MarketOverview;
  }

  try {
    // Fetch major index ETFs as proxies for indices
    const indexSymbols = ['SPY', 'DIA', 'QQQ', 'IWM']; // S&P 500, Dow, Nasdaq, Russell 2000
    const topPerformers = ['AAPL', 'MSFT', 'GOOGL', 'NVDA'];

    const allSymbols = [...indexSymbols, ...topPerformers];
    const quotes = await getBatchQuotes(allSymbols);

    const indices: MarketIndex[] = [
      {
        name: 'S&P 500 (SPY)',
        value: quotes['SPY']?.price || 'N/A',
        change: quotes['SPY']?.change_percent || 'N/A',
      },
      {
        name: 'Dow 30 (DIA)',
        value: quotes['DIA']?.price || 'N/A',
        change: quotes['DIA']?.change_percent || 'N/A',
      },
      {
        name: 'Nasdaq (QQQ)',
        value: quotes['QQQ']?.price || 'N/A',
        change: quotes['QQQ']?.change_percent || 'N/A',
      },
      {
        name: 'Russell 2000 (IWM)',
        value: quotes['IWM']?.price || 'N/A',
        change: quotes['IWM']?.change_percent || 'N/A',
      },
    ];

    const topPerformersData: TopPerformer[] = topPerformers.map((ticker) => ({
      ticker,
      price: quotes[ticker]?.price || 'N/A',
      change: quotes[ticker]?.change_percent || 'N/A',
    }));

    const overview: MarketOverview = {
      indices,
      topPerformers: topPerformersData,
      lastUpdated: new Date().toISOString(),
    };

    // Cache for 1 minute
    await setCachedData(cacheKey, overview, 60);

    return overview;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error fetching market overview:', error.message);
    } else {
      console.error('Error fetching market overview:', String(error));
    }
    throw error;
  }
}
