/**
 * TopMoversCarousel Component
 * 
 * Horizontal scrollable carousel showing top gainers and losers.
 * Groww-inspired clean cards with soft shadows.
 * 
 * @author Roneira AI
 * @version 2026 Groww Theme
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface MoverItem {
  ticker: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  sparklineData?: number[];
}

interface TopMoversCarouselProps {
  gainers: MoverItem[];
  losers: MoverItem[];
  autoScroll?: boolean;
  autoScrollInterval?: number;
  className?: string;
  onItemClick?: (ticker: string) => void;
}

const MiniSparkline: React.FC<{ data: number[]; isPositive: boolean }> = ({ data, isPositive }) => {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 24;
  const width = 60;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="ml-2">
      <defs>
        <linearGradient id={`sparkline-${isPositive ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isPositive ? '#00D09C' : '#EB5B3C'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isPositive ? '#00D09C' : '#EB5B3C'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={isPositive ? '#00D09C' : '#EB5B3C'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const MoverCard: React.FC<{ 
  item: MoverItem; 
  onClick?: () => void;
}> = ({ item, onClick }) => {
  const isPositive = item.changePercent >= 0;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        flex-shrink-0 w-48 p-4 rounded-[16px] cursor-pointer
        bg-white border border-slate-100
        transition-all duration-200
        hover:shadow-soft
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="ticker-symbol text-text-main text-sm font-semibold">
            {item.ticker}
          </span>
          {item.name && (
            <p className="text-xs text-text-muted truncate max-w-[100px]">{item.name}</p>
          )}
        </div>
        <div className={`p-1.5 rounded-full ${isPositive ? 'bg-bullish-50' : 'bg-bearish-50'}`}>
          {isPositive ? (
            <TrendingUp className="w-3 h-3 text-secondary" />
          ) : (
            <TrendingDown className="w-3 h-3 text-danger" />
          )}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-lg font-semibold text-text-main tabular-nums">
            ₹{item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={`text-sm font-medium tabular-nums ${isPositive ? 'text-secondary' : 'text-danger'}`}>
            {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
          </p>
        </div>
        {item.sparklineData && (
          <MiniSparkline data={item.sparklineData} isPositive={isPositive} />
        )}
      </div>
    </motion.div>
  );
};

export const TopMoversCarousel: React.FC<TopMoversCarouselProps> = ({
  gainers,
  losers,
  autoScroll = true,
  autoScrollInterval = 5000,
  className = '',
  onItemClick,
}) => {
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers'>('gainers');
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const items = activeTab === 'gainers' ? gainers : losers;

  // Auto-scroll logic
  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    if (!autoScroll || isPaused || items.length <= 2) return;

    autoScrollTimerRef.current = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scroll('right');
        }
      }
    }, autoScrollInterval);

    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, [autoScroll, isPaused, items.length, autoScrollInterval, scroll]);

  return (
    <div 
      className={`card ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Header with tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          <button
            onClick={() => setActiveTab('gainers')}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${activeTab === 'gainers' 
                ? 'bg-white text-secondary shadow-sm' 
                : 'text-text-muted hover:text-text-main'}
            `}
          >
            <TrendingUp className="w-4 h-4 inline mr-1" />
            Top Gainers
          </button>
          <button
            onClick={() => setActiveTab('losers')}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${activeTab === 'losers' 
                ? 'bg-white text-danger shadow-sm' 
                : 'text-text-muted hover:text-text-main'}
            `}
          >
            <TrendingDown className="w-4 h-4 inline mr-1" />
            Top Losers
          </button>
        </div>

        {/* Navigation arrows */}
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-text-muted hover:text-text-main transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-text-muted hover:text-text-main transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 scroll-smooth"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        <AnimatePresence mode="wait">
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center py-8 text-text-muted"
            >
              No {activeTab} to display
            </motion.div>
          ) : (
            items.map((item, index) => (
              <motion.div
                key={item.ticker}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.05 }}
                style={{ scrollSnapAlign: 'start' }}
              >
                <MoverCard
                  item={item}
                  onClick={() => onItemClick?.(item.ticker)}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TopMoversCarousel;
