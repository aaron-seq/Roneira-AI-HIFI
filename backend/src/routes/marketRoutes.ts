import express, { Request, Response } from 'express';
import axios from 'axios';
import { getCachedData, setCachedData } from '../services/cacheService';

const router = express.Router();

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
const BASE_URL = 'https://www.alphavantage.co/query';

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: string;
}

// Company name mapping
const companyNames: Record<string, string> = {
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corporation',
  GOOGL: 'Alphabet Inc.',
  AMZN: 'Amazon.com Inc.',
  TSLA: 'Tesla Inc.',
  META: 'Meta Platforms Inc.',
  NVDA: 'NVIDIA Corporation',
  AMD: 'Advanced Micro Devices Inc.',
  JPM: 'JPMorgan Chase & Co.',
  V: 'Visa Inc.',
};

/**
 * Fetch global quote for a single symbol with caching
 */
const fetchStockQuote = async (symbol: string): Promise<StockQuote | null> => {
  const cacheKey = `quote:${symbol}`;

  // Check cache first (60 second TTL)
  const cached = await getCachedData(cacheKey);
  if (cached) {
    console.log(`Cache hit for ${symbol}`);
    return cached as StockQuote;
  }

  try {
    console.log(`Fetching quote for ${symbol} from Alpha Vantage...`);
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: symbol,
        apikey: ALPHA_VANTAGE_API_KEY,
      },
      timeout: 5000,
    });

    const quote = response.data['Global Quote'];

    if (!quote || Object.keys(quote).length === 0) {
      console.warn(`No data for ${symbol}`);
      return null;
    }

    const price = parseFloat(quote['05. price'] || 0);
    const change = parseFloat(quote['09. change'] || 0);
    const changePercent = parseFloat((quote['10. change percent'] || '0').replace('%', ''));
    const volume = parseInt(quote['06. volume'] || 0);

    const stockData: StockQuote = {
      symbol,
      name: companyNames[symbol] || symbol,
      price,
      change,
      changePercent,
      volume,
    };

    // Cache for 60 seconds
    await setCachedData(cacheKey, stockData, 60);
    console.log(`Cached quote for ${symbol}`);

    return stockData;
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return null;
  }
};

/**
 * GET /api/market/overview
 * Returns market overview with trending stocks and sentiment
 */
router.get('/overview', async (req: Request, res: Response) => {
  const cacheKey = 'market:overview';

  // Check cache first (2 minute TTL for overview)
  const cached = await getCachedData(cacheKey);
  if (cached) {
    console.log('Returning cached market overview');
    return res.json({
      success: true,
      data: cached,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    console.log('Fetching fresh market overview...');

    // Popular tech stocks to track
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA']; // Reduced to 4 for faster response

    // Fetch quotes sequentially with rate limiting
    const trendingStocks: StockQuote[] = [];

    for (let i = 0; i < symbols.length; i++) {
      const quote = await fetchStockQuote(symbols[i]);
      if (quote) {
        trendingStocks.push(quote);
      }

      // Add delay between requests (12 seconds = 5 requests/minute)
      if (i < symbols.length - 1) {
        console.log(`Waiting 12 seconds before next request... (${i + 1}/${symbols.length})`);
        await new Promise((resolve) => setTimeout(resolve, 12000));
      }
    }

    // Calculate market sentiment
    const positiveStocks = trendingStocks.filter((s) => s.change > 0).length;
    const totalStocks = trendingStocks.length;
    const sentimentScore = totalStocks > 0 ? Math.round((positiveStocks / totalStocks) * 100) : 50;

    let sentimentOverall = 'Neutral';
    if (sentimentScore >= 70) sentimentOverall = 'Bullish';
    else if (sentimentScore >= 50) sentimentOverall = 'Slightly Bullish';
    else if (sentimentScore >= 30) sentimentOverall = 'Slightly Bearish';
    else sentimentOverall = 'Bearish';

    const overviewData = {
      trending_stocks: trendingStocks,
      market_sentiment: {
        overall: sentimentOverall,
        score: sentimentScore,
      },
      last_updated: new Date().toISOString(),
    };

    // Cache for 2 minutes
    await setCachedData(cacheKey, overviewData, 120);
    console.log('Market overview fetched and cached');

    res.json({
      success: true,
      data: overviewData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in market overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market overview',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/market/quote/:symbol
 * Get quote for a specific symbol
 */
router.get('/quote/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    console.log(`Quote request for: ${symbol}`);

    const quote = await fetchStockQuote(symbol.toUpperCase());

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found or API limit reached',
      });
    }

    res.json({
      success: true,
      data: quote,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quote',
    });
  }
});

/**
 * GET /api/market/movers
 * Get top gainers and losers
 */
router.get('/movers', async (req: Request, res: Response) => {
  try {
    // Note: TOP_GAINERS_LOSERS requires premium Alpha Vantage subscription
    // Returning placeholder for now
    res.json({
      success: true,
      data: {
        top_gainers: [],
        top_losers: [],
        most_actively_traded: [],
        message: 'Market movers endpoint requires Alpha Vantage premium subscription',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching market movers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market movers',
    });
  }
});

export default router;
