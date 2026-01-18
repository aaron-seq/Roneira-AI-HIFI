import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Eye, 
  Plus, 
  Trash2, 
  Bell,
  TrendingUp,
  TrendingDown,
  Search
} from 'lucide-react';
import { AnimatedNumber, AnimatedPercentage } from '../components/ui/AnimatedNumber';
import { ConnectionStatus } from '../components/ui/ConnectionStatus';
import { Drawer } from '../components/ui/Drawer';
import { useRealtimeConnection } from '../hooks/useRealtimeConnection';

// Mock watchlist data
const initialWatchlist = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 195.50, change: 2.45, changePercent: 1.27, high: 197.20, low: 193.10, volume: 45230000 },
  { symbol: 'TSLA', name: 'Tesla Inc', price: 265.75, change: -3.25, changePercent: -1.21, high: 272.50, low: 263.00, volume: 82450000 },
  { symbol: 'NVDA', name: 'NVIDIA Corp', price: 875.80, change: 15.60, changePercent: 1.81, high: 882.40, low: 862.00, volume: 38760000 },
  { symbol: 'META', name: 'Meta Platforms', price: 505.20, change: 8.35, changePercent: 1.68, high: 508.90, low: 498.50, volume: 18340000 },
  { symbol: 'AMD', name: 'AMD Inc', price: 165.40, change: -2.10, changePercent: -1.25, high: 169.00, low: 164.20, volume: 52180000 },
  { symbol: 'GOOGL', name: 'Alphabet Inc', price: 175.30, change: 1.85, changePercent: 1.07, high: 177.00, low: 173.50, volume: 24560000 },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

/**
 * Watchlist Page - Real-time stock watchlist with WebSocket updates
 */
export const WatchlistPage: React.FC = () => {
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');

  // WebSocket connection for real-time updates
  const { 
    status: connectionStatus, 
    lastTickTime, 
    ticks,
    subscribe,
    unsubscribe 
  } = useRealtimeConnection({ autoConnect: false });

  // Subscribe to watchlist symbols when connection is ready
  useEffect(() => {
    if (connectionStatus === 'connected' && watchlist.length > 0) {
      subscribe(watchlist.map(w => w.symbol));
    }
  }, [connectionStatus, watchlist.length]);

  // Update watchlist with real-time ticks
  useEffect(() => {
    if (ticks.size > 0) {
      setWatchlist(prev => prev.map(item => {
        const tick = ticks.get(item.symbol);
        if (tick) {
          return {
            ...item,
            price: tick.price,
            change: tick.change,
            changePercent: tick.changePercent,
            high: tick.high,
            low: tick.low,
            volume: tick.volume,
          };
        }
        return item;
      }));
    }
  }, [ticks]);

  const filteredWatchlist = searchQuery
    ? watchlist.filter(item => 
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : watchlist;

  const handleAddSymbol = () => {
    if (newSymbol && !watchlist.find(w => w.symbol === newSymbol.toUpperCase())) {
      const newItem = {
        symbol: newSymbol.toUpperCase(),
        name: `${newSymbol.toUpperCase()} Inc.`,
        price: 100 + Math.random() * 200,
        change: Math.random() * 10 - 5,
        changePercent: Math.random() * 5 - 2.5,
        high: 110,
        low: 90,
        volume: Math.floor(Math.random() * 50000000),
      };
      setWatchlist([...watchlist, newItem]);
      setNewSymbol('');
      setIsAddDrawerOpen(false);
    }
  };

  const handleRemoveSymbol = (symbol: string) => {
    setWatchlist(watchlist.filter(w => w.symbol !== symbol));
    unsubscribe([symbol]);
  };

  return (
    <motion.div
      className="min-h-screen p-6 space-y-6"
      style={{ backgroundColor: 'var(--bg-0)' }}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Page Header */}
      <motion.header 
        className="flex items-center justify-between"
        variants={itemVariants}
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--text-1)' }}>
            <Eye size={28} />
            Watchlist
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            {watchlist.length} symbols tracked
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatus 
            status={connectionStatus === 'connected' ? 'connected' : connectionStatus === 'reconnecting' ? 'reconnecting' : 'disconnected'} 
            lastTickTime={lastTickTime || undefined}
          />
          <button
            onClick={() => setIsAddDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium"
            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
          >
            <Plus size={18} />
            Add Symbol
          </button>
        </div>
      </motion.header>

      {/* Search Bar */}
      <motion.div 
        className="relative"
        variants={itemVariants}
      >
        <Search 
          size={18} 
          className="absolute left-4 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-3)' }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search symbols..."
          className="w-full pl-11 pr-4 py-3 rounded-xl"
          style={{ 
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-1)'
          }}
        />
      </motion.div>

      {/* Watchlist Grid */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        variants={itemVariants}
      >
        {filteredWatchlist.map((stock) => (
          <motion.div
            key={stock.symbol}
            className="p-4 rounded-xl relative group"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)'
            }}
            whileHover={{ 
              borderColor: 'var(--border-hover)',
              boxShadow: 'var(--shadow-card-hover)'
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg" style={{ color: 'var(--text-1)' }}>
                  {stock.symbol}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>{stock.name}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text-2)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Bell size={16} />
                </button>
                <button
                  onClick={() => handleRemoveSymbol(stock.symbol)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--color-danger)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-4">
              <AnimatedNumber
                value={stock.price}
                prefix="$"
                precision={2}
                size="xl"
                className="font-bold"
                highlightChange
              />
              <span 
                className="flex items-center gap-1 text-sm font-medium"
                style={{ color: stock.change >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
              >
                {stock.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <AnimatedPercentage value={stock.changePercent} size="sm" />
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span style={{ color: 'var(--text-3)' }}>High</span>
                <p className="font-mono" style={{ color: 'var(--text-1)' }}>${stock.high.toFixed(2)}</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-3)' }}>Low</span>
                <p className="font-mono" style={{ color: 'var(--text-1)' }}>${stock.low.toFixed(2)}</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-3)' }}>Volume</span>
                <p className="font-mono" style={{ color: 'var(--text-1)' }}>{(stock.volume / 1000000).toFixed(1)}M</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Empty State */}
      {filteredWatchlist.length === 0 && (
        <motion.div 
          className="text-center py-16"
          variants={itemVariants}
        >
          <Eye size={48} className="mx-auto mb-4" style={{ color: 'var(--text-3)' }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-1)' }}>
            No symbols found
          </h3>
          <p style={{ color: 'var(--text-2)' }}>
            {searchQuery ? 'Try a different search term' : 'Add symbols to start tracking'}
          </p>
        </motion.div>
      )}

      {/* Add Symbol Drawer */}
      <Drawer
        isOpen={isAddDrawerOpen}
        onClose={() => setIsAddDrawerOpen(false)}
        title="Add Symbol"
        description="Add a stock to your watchlist"
        position="right"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-1)' }}>
              Symbol
            </label>
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL"
              className="w-full px-4 py-2.5 rounded-lg uppercase"
              style={{ 
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-1)'
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
            />
          </div>
          <button
            onClick={handleAddSymbol}
            className="w-full py-3 rounded-xl font-medium"
            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
          >
            Add to Watchlist
          </button>
        </div>
      </Drawer>
    </motion.div>
  );
};

export default WatchlistPage;
