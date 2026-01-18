/**
 * ChartMorphTransition Component
 * 
 * Wrapper for smooth morphing transitions between different chart types.
 * Uses framer-motion layoutId for interpolation.
 * 
 * @author Roneira AI
 * @version 2026
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, BarChart3, CandlestickChart, AreaChart } from 'lucide-react';

export type ChartType = 'line' | 'bar' | 'candlestick' | 'area';

interface ChartTypeConfig {
  type: ChartType;
  label: string;
  icon: React.ReactNode;
}

const chartTypes: ChartTypeConfig[] = [
  { type: 'line', label: 'Line', icon: <LineChart className="w-4 h-4" /> },
  { type: 'area', label: 'Area', icon: <AreaChart className="w-4 h-4" /> },
  { type: 'bar', label: 'Bar', icon: <BarChart3 className="w-4 h-4" /> },
  { type: 'candlestick', label: 'Candlestick', icon: <CandlestickChart className="w-4 h-4" /> },
];

interface ChartMorphTransitionProps {
  children: (chartType: ChartType) => React.ReactNode;
  defaultType?: ChartType;
  availableTypes?: ChartType[];
  onTypeChange?: (type: ChartType) => void;
  className?: string;
  showControls?: boolean;
}

export const ChartMorphTransition: React.FC<ChartMorphTransitionProps> = ({
  children,
  defaultType = 'line',
  availableTypes = ['line', 'area', 'bar', 'candlestick'],
  onTypeChange,
  className = '',
  showControls = true,
}) => {
  const [activeType, setActiveType] = useState<ChartType>(defaultType);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleTypeChange = useCallback((type: ChartType) => {
    if (type === activeType || isTransitioning) return;
    
    setIsTransitioning(true);
    setActiveType(type);
    onTypeChange?.(type);
    
    // Reset transitioning state after animation
    setTimeout(() => setIsTransitioning(false), 350);
  }, [activeType, isTransitioning, onTypeChange]);

  const filteredChartTypes = chartTypes.filter(ct => availableTypes.includes(ct.type));

  return (
    <div className={`relative ${className}`}>
      {/* Chart type selector */}
      {showControls && (
        <div className="absolute top-4 right-4 z-10 flex gap-1 p-1 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
          {filteredChartTypes.map((chartConfig) => (
            <motion.button
              key={chartConfig.type}
              onClick={() => handleTypeChange(chartConfig.type)}
              className={`
                relative px-3 py-2 rounded-md text-xs font-medium
                transition-colors duration-200
                ${activeType === chartConfig.type
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'}
              `}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-label={`Switch to ${chartConfig.label} chart`}
              aria-pressed={activeType === chartConfig.type}
            >
              {/* Active indicator background */}
              {activeType === chartConfig.type && (
                <motion.div
                  layoutId="chart-type-indicator"
                  className="absolute inset-0 rounded-md bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30"
                  initial={false}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 35,
                  }}
                />
              )}
              
              <span className="relative flex items-center gap-1.5">
                {chartConfig.icon}
                <span className="hidden sm:inline">{chartConfig.label}</span>
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {/* Chart container with morph transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeType}
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -10 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            duration: 0.3,
          }}
          className="w-full h-full"
        >
          {children(activeType)}
        </motion.div>
      </AnimatePresence>

      {/* Loading overlay during transition */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] rounded-xl pointer-events-none"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * useChartMorph Hook
 * 
 * Provides chart type state management and transition logic
 */
export const useChartMorph = (defaultType: ChartType = 'line') => {
  const [chartType, setChartType] = useState<ChartType>(defaultType);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const changeType = useCallback((type: ChartType) => {
    if (type === chartType || isTransitioning) return;
    
    setIsTransitioning(true);
    setChartType(type);
    
    setTimeout(() => setIsTransitioning(false), 350);
  }, [chartType, isTransitioning]);

  const cycleType = useCallback(() => {
    const types: ChartType[] = ['line', 'area', 'bar', 'candlestick'];
    const currentIndex = types.indexOf(chartType);
    const nextIndex = (currentIndex + 1) % types.length;
    changeType(types[nextIndex]);
  }, [chartType, changeType]);

  return {
    chartType,
    isTransitioning,
    changeType,
    cycleType,
  };
};

export default ChartMorphTransition;
