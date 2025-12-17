import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketOverview } from '../../services/financialDataService';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useFinancialDataStore } from '../../store/financialDataStore';
import { TrendingUp, TrendingDown, DollarSign, Activity, Star, X, Plus } from 'lucide-react';

interface MarketStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: string;
}

interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

interface MarketOverviewData {
  trending_stocks?: MarketStock[];
  indices?: MarketIndex[];
  market_sentiment?: {
    overall: string;
    score: number;
  };
  last_updated?: string;
}

const INDEX_OPTIONS = [
  { symbol: '^NSEI', name: 'Nifty 50', tradingViewSymbol: 'NSE:NIFTY' },
  { symbol: '^BSESN', name: 'Sensex', tradingViewSymbol: 'BSE:SENSEX' },
  { symbol: '^IXIC', name: 'NASDAQ', tradingViewSymbol: 'NASDAQ:IXIC' },
  { symbol: 'NIFTY_GIFT', name: 'Gift Nifty', tradingViewSymbol: 'NSE:NIFTYBEES' },
];

export const MarketOverviewDashboard: React.FC = () => {
  const { 
    watchlist, 
    addToWatchlist, 
    removeFromWatchlist, 
    selectedIndexSymbol,
    setSelectedIndexSymbol 
  } = useFinancialDataStore();
  
  const [showAddWatchlist, setShowAddWatchlist] = useState(false);
  const [newWatchlistSymbol, setNewWatchlistSymbol] = useState('');

  const { data: marketData, isLoading, error } = useQuery<MarketOverviewData>({
    queryKey: ['marketOverview'],
    queryFn: fetchMarketOverview,
    refetchInterval: 60000,
  });

  const handleAddToWatchlist = (symbol: string, name: string) => {
    addToWatchlist(symbol, name);
  };

  const handleRemoveFromWatchlist = (symbol: string) => {
    removeFromWatchlist(symbol);
  };

  const handleManualAdd = () => {
    if (newWatchlistSymbol.trim()) {
      addToWatchlist(newWatchlistSymbol.toUpperCase(), newWatchlistSymbol.toUpperCase());
      setNewWatchlistSymbol('');
      setShowAddWatchlist(false);
    }
  };

  const selectedIndex = INDEX_OPTIONS.find(idx => idx.symbol === selectedIndexSymbol) || INDEX_OPTIONS[0];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <LoadingSpinner />
        <p className="mt-4 text-gray-400">Loading market data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="text-red-400 text-lg">Error loading market data</div>
        <div className="text-gray-400 text-sm">{(error as Error).message}</div>
        <button
          onClick={() => window.location.reload()}
          className="btn-secondary px-4 py-2 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!marketData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400 text-lg">No market data available</div>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  };

  const formatPercent = (percent: number) => {
    return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Market Overview</h1>
          <p className="text-gray-400 mt-1">Real-time market data and trends</p>
        </div>
        {marketData.last_updated && (
          <div className="text-sm text-gray-400">
            Last updated: {new Date(marketData.last_updated).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Watchlist Section */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
            <h2 className="text-xl font-semibold text-white">Your Watchlist</h2>
            <span className="text-sm text-gray-400">({watchlist.length} stocks)</span>
          </div>
          <button
            onClick={() => setShowAddWatchlist(!showAddWatchlist)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Stock
          </button>
        </div>

        {showAddWatchlist && (
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newWatchlistSymbol}
              onChange={(e) => setNewWatchlistSymbol(e.target.value.toUpperCase())}
              placeholder="Enter ticker symbol (e.g. AAPL)"
              className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-white focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
            />
            <button
              onClick={handleManualAdd}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddWatchlist(false)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {watchlist.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {watchlist.map((item) => (
              <div
                key={item.symbol}
                className="bg-gray-900 rounded-lg p-3 border border-gray-700 flex items-center justify-between group hover:border-yellow-500 transition-colors"
              >
                <span className="font-bold text-white">{item.symbol}</span>
                <button
                  onClick={() => handleRemoveFromWatchlist(item.symbol)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            No stocks in watchlist. Click "Add Stock" or use the ⭐ button on trending stocks below.
          </div>
        )}
      </div>

      {/* Index Charts Section */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Index Charts</h2>
          <div className="flex gap-2">
            {INDEX_OPTIONS.map((idx) => (
              <button
                key={idx.symbol}
                onClick={() => setSelectedIndexSymbol(idx.symbol)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedIndexSymbol === idx.symbol
                    ? 'bg-white text-black'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {idx.name}
              </button>
            ))}
          </div>
        </div>

        {/* TradingView Widget */}
        <div className="h-[400px] rounded-lg overflow-hidden bg-gray-900">
          <iframe
            key={selectedIndex.tradingViewSymbol}
            src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${selectedIndex.tradingViewSymbol}&interval=D&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=1a1a2e&studies=%5B%5D&theme=dark&style=1&timezone=exchange&withdateranges=1&showpopupbutton=0&width=100%25&height=100%25&locale=en`}
            className="w-full h-full border-0"
            title={`${selectedIndex.name} Chart`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      </div>

      {/* Market Sentiment */}
      {marketData.market_sentiment && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="w-6 h-6 text-blue-400" />
              <div>
                <h2 className="text-xl font-semibold text-white">Market Sentiment</h2>
                <p className="text-gray-400 text-sm mt-1">Overall market mood</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {marketData.market_sentiment.overall}
              </div>
              <div className="text-sm text-gray-400">
                Score: {marketData.market_sentiment.score}/100
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Market Indices */}
      {marketData.indices && marketData.indices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {marketData.indices.map((index, idx) => (
            <div
              key={idx}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-white">{index.name}</h3>
                {index.change >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {index.value.toLocaleString()}
              </div>
              <div className={`text-sm font-medium ${index.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPercent(index.changePercent)} ({index.change > 0 ? '+' : ''}{index.change.toFixed(2)})
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trending Stocks */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center space-x-3 mb-6">
          <DollarSign className="w-6 h-6 text-green-400" />
          <h2 className="text-xl font-semibold text-white">Trending Stocks</h2>
        </div>

        {marketData.trending_stocks && marketData.trending_stocks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketData.trending_stocks.map((stock, index) => {
              const isInWatchlist = watchlist.some(w => w.symbol === stock.symbol);
              return (
                <div
                  key={index}
                  className="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/20"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">{stock.symbol}</h3>
                      <p className="text-sm text-gray-400 truncate">{stock.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => 
                          isInWatchlist 
                            ? handleRemoveFromWatchlist(stock.symbol)
                            : handleAddToWatchlist(stock.symbol, stock.name)
                        }
                        className={`p-1 rounded transition-colors ${
                          isInWatchlist 
                            ? 'text-yellow-400 hover:text-yellow-300' 
                            : 'text-gray-500 hover:text-yellow-400'
                        }`}
                        title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                      >
                        <Star className={`w-5 h-5 ${isInWatchlist ? 'fill-yellow-400' : ''}`} />
                      </button>
                      {stock.change >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-green-400 flex-shrink-0" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-white">{formatPrice(stock.price)}</span>
                      <span className={`text-sm font-medium ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPercent(stock.changePercent)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400">
                      {stock.volume && <span>Vol: {(stock.volume / 1000000).toFixed(2)}M</span>}
                      {stock.marketCap && <span className="text-right">{stock.marketCap}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-400">No trending stocks available</div>
          </div>
        )}
      </div>

      {/* Market Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Total Volume</h3>
          <div className="text-2xl font-bold text-white">
            {marketData.trending_stocks
              ? (marketData.trending_stocks.reduce((sum, stock) => sum + (stock.volume || 0), 0) / 1000000).toFixed(2)
              : '0.00'}M
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Gainers</h3>
          <div className="text-2xl font-bold text-green-400">
            {marketData.trending_stocks ? marketData.trending_stocks.filter((s) => s.change > 0).length : 0}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Losers</h3>
          <div className="text-2xl font-bold text-red-400">
            {marketData.trending_stocks ? marketData.trending_stocks.filter((s) => s.change < 0).length : 0}
          </div>
        </div>
      </div>
    </div>
  );
};
