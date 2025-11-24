/**
 * Fetch market overview using Twelve Data API (free tier)
 * Sign up at https://twelvedata.com for a free API key
 */
export const fetchMarketOverview = async () => {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
  const TWELVE_DATA_API_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY || 'demo';

  try {
    // Try backend first
    const backendResponse = await fetch(`${API_BASE_URL}/api/market/overview`);
    if (backendResponse.ok) {
      const result = await backendResponse.json();
      // Extract the nested data object
      return result.data; // Changed from: return await backendResponse.json();
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
      marketCap: getMarketCap(symbol)
    }));

    return {
      trending_stocks: stocks,
      indices: await fetchMajorIndices(),
      market_sentiment: calculateMarketSentiment(stocks),
      last_updated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error fetching market overview:', error);
    throw error;
  }
};
