/**
 * Fetch market overview using Twelve Data API (free tier)
 * Sign up at https://twelvedata.com for a free API key
 */

// Helper functions
const getCompanyName = (symbol: string): string => {
  const companies: Record<string, string> = {
    'AAPL': 'Apple Inc.',
    'MSFT': 'Microsoft Corporation',
    'GOOGL': 'Alphabet Inc.',
    'AMZN': 'Amazon.com Inc.',
    'TSLA': 'Tesla Inc.',
    'META': 'Meta Platforms Inc.',
    'NVDA': 'NVIDIA Corporation',
    'AMD': 'Advanced Micro Devices'
  };
  return companies[symbol] || symbol;
};

const getMarketCap = (): number => {
  return 1000000000; // Mock value
};

const fetchMajorIndices = async (): Promise<any[]> => {
  return [
    { name: 'S&P 500', value: 4500, change: 0.5 },
    { name: 'NASDAQ', value: 14000, change: 0.8 },
    { name: 'DOW JONES', value: 35000, change: 0.2 }
  ];
};

const calculateMarketSentiment = (): { label: string; score: number } => {
  return { label: 'Bullish', score: 75 };
};

export const fetchMarketOverview = async () => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  const TWELVE_DATA_API_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY || 'demo';

  try {
    // Try backend first
    const backendResponse = await fetch(`${API_BASE_URL}/api/market/overview`);
    if (backendResponse.ok) {
      const result = await backendResponse.json();
      // Extract the nested data object
      return result.data;
    }

    // Fetch from Twelve Data
    const symbols = 'AAPL,MSFT,GOOGL,AMZN,TSLA,META,NVDA,AMD';

    const response = await fetch(
      `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${TWELVE_DATA_API_KEY}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch market data');
    }

    const data = await response.json();

    // Transform the data
    const stocks = Object.entries(data).map(([symbol, quoteData]: [string, any]) => ({
      symbol: symbol,
      name: quoteData.name || getCompanyName(symbol),
      price: parseFloat(quoteData.close || 0),
      change: parseFloat(quoteData.change || 0),
      changePercent: parseFloat(quoteData.percent_change || 0),
      volume: parseInt(quoteData.volume || 0),
      marketCap: getMarketCap()
    }));

    return {
      trending_stocks: stocks,
      indices: await fetchMajorIndices(),
      market_sentiment: calculateMarketSentiment(),
      last_updated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error fetching market overview:', error);
    throw error;
  }
};

export const fetchPortfolio = async (userId: string) => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  try {
    const response = await fetch(`${API_BASE_URL}/api/portfolio/${userId}`);
    if (!response.ok) throw new Error('Failed to fetch portfolio');
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    throw error;
  }
};

export const updatePortfolio = async (userId: string, ticker: string, shares: number, price: number, action: 'add' | 'remove') => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  try {
    const response = await fetch(`${API_BASE_URL}/api/portfolio/${userId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, shares, price, action })
    });
    if (!response.ok) throw new Error('Failed to update portfolio');
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error updating portfolio:', error);
    throw error;
  }
};

// Health check
export const fetchMarketHealth = async () => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) throw new Error('Health check failed');
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching health status:', error);
    // Return default offline status instead of throwing to prevent UI crash
    return {
      service_status: "unknown",
      timestamp: new Date().toISOString(),
      environment: "development",
      version: "0.0.0",
      ml_service_status: "unknown",
      uptime_seconds: 0
    };
  }
};

// --- New Features ---

export const fetchPDMSignals = async () => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  try {
    const response = await fetch(`${API_BASE_URL}/api/pdm/signals`);
    if (!response.ok) throw new Error('Failed to fetch PDM signals');
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching PDM signals:', error);
    return { pdm_signals: [], opportunities_found: 0 };
  }
};

export const executePDMBacktest = async (startDate: string, endDate: string) => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  try {
    const response = await fetch(`${API_BASE_URL}/api/pdm/backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date: startDate, end_date: endDate })
    });
    if (!response.ok) throw new Error('Failed to execute backtest');
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error executing PDM backtest:', error);
    throw error;
  }
};

export const fetchMarketNews = async () => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  try {
    const response = await fetch(`${API_BASE_URL}/api/news`);
    if (!response.ok) throw new Error('Failed to fetch news');
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching market news:', error);
    return [];
  }
};
