/**
 * PredictionCard Component
 * 
 * Compact ML stock prediction card (320x180px) with:
 * - Glassmorphic styling
 * - Hover lift animation
 * - Confidence visualization
 * - Real-time price updates
 * - Accessibility support
 * 
 * @author Roneira AI
 * @version 2026
 */

import React, { useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { TrendingUp, TrendingDown, Activity, AlertCircle, Loader2 } from 'lucide-react';
import { AnimatedNumber, AnimatedPercentage } from '../ui/AnimatedNumber';
import { MiniConfidence } from '../ui/ConfidenceGauge';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export interface PredictionData {
  ticker: string;
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  priceChange: number;
  priceChangePercent: number;
  timeframe?: string;
}

interface PredictionCardProps {
  data: PredictionData;
  isLoading?: boolean;
  isError?: boolean;
  onClick?: () => void;
  className?: string;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({
  data,
  isLoading = false,
  isError = false,
  onClick,
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);

  const {
    ticker,
    currentPrice,
    predictedPrice,
    confidence,
    signal,
    priceChangePercent,
    timeframe = '7D',
  } = data;

  // Signal styling
  const signalConfig = {
    bullish: {
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      icon: TrendingUp,
      label: 'Bullish',
    },
    bearish: {
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      icon: TrendingDown,
      label: 'Bearish',
    },
    neutral: {
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      icon: Activity,
      label: 'Neutral',
    },
  };

  const config = signalConfig[signal];
  const SignalIcon = config.icon;

  // Motion variants
  const cardVariants: Variants = prefersReducedMotion
    ? {
        rest: {},
        hover: {},
      }
    : {
        rest: {
          y: 0,
          boxShadow: '0 8px 32px rgba(0, 245, 255, 0.1)',
        },
        hover: {
          y: -8,
          boxShadow: '0 20px 60px rgba(0, 245, 255, 0.2)',
        },
      };

  // Loading state
  if (isLoading) {
    return (
      <div className={`prediction-card p-5 w-80 h-44 flex items-center justify-center ${className}`}>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-neon-cyan animate-spin" />
          <span className="text-sm text-slate-400">Loading prediction...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className={`prediction-card p-5 w-80 h-44 flex items-center justify-center border-red-500/20 ${className}`}>
        <div className="flex flex-col items-center gap-2 text-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <span className="text-sm text-red-400">Failed to load prediction</span>
          <button 
            onClick={onClick}
            className="text-xs text-slate-400 hover:text-white underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={`
        prediction-card p-5 w-80 h-44 cursor-pointer
        focus-visible-ring
        ${className}
      `}
      variants={cardVariants}
      initial="rest"
      whileHover="hover"
      animate={isHovered && !prefersReducedMotion ? 'hover' : 'rest'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`${ticker} prediction: ${config.label} signal with ${confidence}% confidence. Current price $${currentPrice.toFixed(2)}, predicted $${predictedPrice.toFixed(2)}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Header: Ticker & Signal Badge */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="ticker-symbol text-2xl text-white font-bold tracking-wide">
          {ticker}
        </h3>
        <span 
          className={`
            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
            ${config.bgColor} ${config.color} border ${config.borderColor}
          `}
        >
          <SignalIcon className="w-3.5 h-3.5" />
          {config.label}
        </span>
      </div>

      {/* Prices */}
      <div className="space-y-2 mb-4">
        {/* Current Price */}
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider">Current</span>
          <AnimatedNumber
            value={currentPrice}
            prefix="$"
            precision={2}
            size="lg"
            highlightChange
            className="text-white"
          />
        </div>

        {/* Predicted Price */}
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider">
            Predicted ({timeframe})
          </span>
          <div className="flex items-center gap-2">
            <AnimatedNumber
              value={predictedPrice}
              prefix="$"
              precision={2}
              size="md"
              className={config.color}
            />
            <AnimatedPercentage
              value={priceChangePercent}
              size="sm"
              colorCode
            />
          </div>
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="pt-3 border-t border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider">
            ML Confidence
          </span>
          <MiniConfidence value={confidence} />
        </div>
      </div>

      {/* Hover glow effect */}
      {!prefersReducedMotion && isHovered && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            boxShadow: '0 0 40px rgba(0, 245, 255, 0.15) inset',
          }}
        />
      )}
    </motion.div>
  );
};

/**
 * PredictionCardGrid Component
 * Grid layout for multiple prediction cards with staggered animation
 */
interface PredictionCardGridProps {
  predictions: PredictionData[];
  isLoading?: boolean;
  onCardClick?: (ticker: string) => void;
  className?: string;
}

export const PredictionCardGrid: React.FC<PredictionCardGridProps> = ({
  predictions,
  isLoading = false,
  onCardClick,
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();

  const containerVariants: Variants = prefersReducedMotion
    ? {
        hidden: {},
        show: {},
      }
    : {
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.1,
          },
        },
      };

  const itemVariants: Variants = prefersReducedMotion
    ? {
        hidden: {},
        show: {},
      }
    : {
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            type: 'spring',
            stiffness: 180,
            damping: 12,
          },
        },
      };

  return (
    <motion.div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {predictions.map((prediction) => (
        <motion.div key={prediction.ticker} variants={itemVariants}>
          <PredictionCard
            data={prediction}
            isLoading={isLoading}
            onClick={() => onCardClick?.(prediction.ticker)}
          />
        </motion.div>
      ))}
    </motion.div>
  );
};

export default PredictionCard;
