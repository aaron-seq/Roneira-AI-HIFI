import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

export interface SparklineData {
  values: number[];
  color?: 'bullish' | 'bearish' | 'neutral';
}

export interface StatCardProps {
  title: string;
  value: number;
  previousValue?: number;
  prefix?: string;
  suffix?: string;
  precision?: number;
  description?: string;
  sparkline?: SparklineData;
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showChange?: boolean;
}

/**
 * StatCard - Financial stat display card with animated numbers and optional sparkline
 * Supports bullish/bearish styling based on value changes
 */
export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  previousValue,
  prefix = '',
  suffix = '',
  precision = 2,
  description,
  sparkline,
  icon,
  loading = false,
  className = '',
  size = 'md',
  showChange = true,
}) => {
  const change = previousValue !== undefined ? value - previousValue : 0;
  const changePercent = previousValue !== undefined && previousValue !== 0
    ? ((value - previousValue) / previousValue) * 100
    : 0;
  
  const trend = change > 0 ? 'bullish' : change < 0 ? 'bearish' : 'neutral';
  
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };
  
  const valueSizes = {
    sm: 'lg' as const,
    md: 'xl' as const,
    lg: 'xl' as const,
  };

  const trendColors = {
    bullish: 'var(--color-success)',
    bearish: 'var(--color-danger)',
    neutral: 'var(--text-3)',
  };

  const TrendIcon = trend === 'bullish' 
    ? ArrowUpRight 
    : trend === 'bearish' 
      ? ArrowDownRight 
      : Minus;

  // Simple SVG sparkline renderer
  const renderSparkline = () => {
    if (!sparkline || sparkline.values.length < 2) return null;
    
    const { values, color = trend } = sparkline;
    const strokeColor = trendColors[color];
    
    const width = 80;
    const height = 32;
    const padding = 2;
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    
    const points = values.map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((v - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    }).join(' ');
    
    return (
      <svg 
        width={width} 
        height={height} 
        className="opacity-80"
        role="img"
        aria-label={`Sparkline chart showing ${values.length} data points`}
      >
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div 
        className={`rounded-xl ${sizeClasses[size]} ${className}`}
        style={{ 
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--border-default)'
        }}
      >
        <div className="animate-pulse">
          <div 
            className="h-4 w-24 rounded mb-3"
            style={{ backgroundColor: 'var(--surface-2)' }}
          />
          <div 
            className="h-8 w-32 rounded mb-2"
            style={{ backgroundColor: 'var(--surface-2)' }}
          />
          <div 
            className="h-3 w-16 rounded"
            style={{ backgroundColor: 'var(--surface-2)' }}
          />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={`rounded-xl ${sizeClasses[size]} ${className}`}
      style={{ 
        backgroundColor: 'var(--surface-1)',
        border: '1px solid var(--border-default)'
      }}
      whileHover={{ 
        borderColor: 'var(--border-hover)',
        boxShadow: 'var(--shadow-card-hover)'
      }}
      transition={{ duration: 0.15 }}
      role="article"
      aria-label={`${title}: ${prefix}${value.toFixed(precision)}${suffix}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && (
            <span style={{ color: 'var(--text-2)' }}>
              {icon}
            </span>
          )}
          <span 
            className="text-sm font-medium"
            style={{ color: 'var(--text-2)' }}
          >
            {title}
          </span>
        </div>
        {sparkline && renderSparkline()}
      </div>
      
      {/* Value */}
      <div className="flex items-baseline gap-3">
        <AnimatedNumber
          value={value}
          prefix={prefix}
          suffix={suffix}
          precision={precision}
          size={valueSizes[size]}
          highlightChange={true}
          className="font-semibold"
        />
        
        {/* Change indicator */}
        {showChange && previousValue !== undefined && (
          <div 
            className="flex items-center gap-1 text-sm font-medium"
            style={{ color: trendColors[trend] }}
          >
            <TrendIcon size={14} />
            <span>
              {change >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      
      {/* Description */}
      {description && (
        <p 
          className="text-xs mt-2"
          style={{ color: 'var(--text-3)' }}
        >
          {description}
        </p>
      )}
    </motion.div>
  );
};

export default StatCard;
