/**
 * Market Overview Dashboard
 * 
 * Real-time market data and trends display.
 * Groww-inspired light theme with soft aesthetics.
 * 
 * @author Aaron Sequeira
 * @version 2026 Groww Theme
 */

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
        <p className="mt-4 text-text-muted">Loading market data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="text-danger text-lg">Error loading market data</div>
        <div className="text-text-muted text-sm">{(error as Error).message}</div>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!marketData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-text-muted text-lg">No market data available</div>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(price);
  };

  const formatPercent = (percent: number) => {
    return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6 p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-main">Market Overview</h1>
          <p className="text-text-muted mt-1">Real-time market data and trends</p>
        </div>
        {marketData.last_updated && (
          <div className="text-sm text-text-muted">
            Last updated: {new Date(marketData.last_updated).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Watchlist Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-neutral-100">
              <Star className="w-5 h-5 text-neutral-500 fill-neutral-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-main">Your Watchlist</h2>
              <span className="text-sm text-text-muted">({watchlist.length} stocks)</span>
            </div>
          </div>
          <button
            onClick={() => setShowAddWatchlist(!showAddWatchlist)}
            className="btn-ghost text-sm"
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
              placeholder="Enter ticker symbol (e.g. RELIANCE)"
              className="input flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
            />
            <button onClick={handleManualAdd} className="btn-secondary">Add</button>
            <button onClick={() => setShowAddWatchlist(false)} className="btn-outline">Cancel</button>
          </div>
        )}

        {watchlist.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {watchlist.map((item) => (
              <div
                key={item.symbol}
                className="bg-slate-50 rounded-xl p-3 flex items-center justify-between group hover:bg-primary/5 transition-colors"
              >
                <span className="font-semibold text-text-main">{item.symbol}</span>
                <button
                  onClick={() => handleRemoveFromWatchlist(item.symbol)}
                  className="opacity-0 group-hover:opacity-100 text-danger hover:text-danger/80 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-text-muted">
            No stocks in watchlist. Click "Add Stock" or use the ⭐ button on trending stocks below.
          </div>
        )}
      </div>

      {/* Index Charts Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-main">Index Charts</h2>
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
            {INDEX_OPTIONS.map((idx) => (
              <button
                key={idx.symbol}
                onClick={() => setSelectedIndexSymbol(idx.symbol)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedIndexSymbol === idx.symbol
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {idx.name}
              </button>
            ))}
          </div>
        </div>

        {/* TradingView Widget */}
        <div className="h-[400px] rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
          <iframe
            key={selectedIndex.tradingViewSymbol}
            src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${selectedIndex.tradingViewSymbol}&interval=D&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=f4f6f8&studies=%5B%5D&theme=light&style=1&timezone=exchange&withdateranges=1&showpopupbutton=0&width=100%25&height=100%25&locale=en`}
            className="w-full h-full border-0"
            title={`${selectedIndex.name} Chart`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      </div>

      {/* Market Sentiment */}
      {marketData.market_sentiment && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-main">Market Sentiment</h2>
                <p className="text-text-muted text-sm">Overall market mood</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-text-main">
                {marketData.market_sentiment.overall}
              </div>
              <div className="text-sm text-text-muted">
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
              className="card p-5 hover:shadow-soft-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-text-main">{index.name}</h3>
                <div className={`p-1.5 rounded-full ${index.change >= 0 ? 'bg-bullish-50' : 'bg-bearish-50'}`}>
                  {index.change >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-secondary" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-danger" />
                  )}
                </div>
              </div>
              <div className="text-2xl font-semibold text-text-main mb-1 tabular-nums">
                {index.value.toLocaleString()}
              </div>
              <div className={`text-sm font-medium ${index.change >= 0 ? 'text-secondary' : 'text-danger'}`}>
                {formatPercent(index.changePercent)} ({index.change > 0 ? '+' : ''}{index.change.toFixed(2)})
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trending Stocks */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 rounded-xl bg-secondary/10">
            <DollarSign className="w-5 h-5 text-secondary" />
          </div>
          <h2 className="text-lg font-semibold text-text-main">Trending Stocks</h2>
        </div>

        {marketData.trending_stocks && marketData.trending_stocks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketData.trending_stocks.map((stock, index) => {
              const isInWatchlist = watchlist.some(w => w.symbol === stock.symbol);
              return (
                <div
                  key={index}
                  className="bg-slate-50 rounded-[16px] p-4 hover:bg-white hover:shadow-soft transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-base font-semibold text-text-main">{stock.symbol}</h3>
                      <p className="text-xs text-text-muted truncate max-w-[150px]">{stock.name}</p>
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
                            ? 'text-neutral-500' 
                            : 'text-slate-400 hover:text-neutral-500'
                        }`}
                        title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                      >
                        <Star className={`w-4 h-4 ${isInWatchlist ? 'fill-neutral-500' : ''}`} />
                      </button>
                      <div className={`p-1.5 rounded-full ${stock.change >= 0 ? 'bg-bullish-50' : 'bg-bearish-50'}`}>
                        {stock.change >= 0 ? (
                          <TrendingUp className="w-3 h-3 text-secondary" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-danger" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-semibold text-text-main tabular-nums">{formatPrice(stock.price)}</span>
                      <span className={`text-sm font-medium ${stock.change >= 0 ? 'text-secondary' : 'text-danger'}`}>
                        {formatPercent(stock.changePercent)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-text-muted">
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
            <div className="text-text-muted">No trending stocks available</div>
          </div>
        )}
      </div>

      {/* Market Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-medium text-text-muted mb-2">Total Volume</h3>
          <div className="text-2xl font-semibold text-text-main tabular-nums">
            {marketData.trending_stocks
              ? (marketData.trending_stocks.reduce((sum, stock) => sum + (stock.volume || 0), 0) / 1000000).toFixed(2)
              : '0.00'}M
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-medium text-text-muted mb-2">Gainers</h3>
          <div className="text-2xl font-semibold text-secondary">
            {marketData.trending_stocks ? marketData.trending_stocks.filter((s) => s.change > 0).length : 0}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-medium text-text-muted mb-2">Losers</h3>
          <div className="text-2xl font-semibold text-danger">
            {marketData.trending_stocks ? marketData.trending_stocks.filter((s) => s.change < 0).length : 0}
          </div>
        </div>
      </div>
    </div>
  );
};
