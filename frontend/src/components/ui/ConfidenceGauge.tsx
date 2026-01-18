/**
 * ConfidenceGauge Component
 * 
 * Radial gauge for ML model confidence visualization (0-100%).
 * Features animated fill and gradient coloring based on confidence level.
 * 
 * @author Roneira AI
 * @version 2026
 */

import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface ConfidenceGaugeProps {
  value: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  className?: string;
  animated?: boolean;
}

export const ConfidenceGauge: React.FC<ConfidenceGaugeProps> = ({
  value,
  size = 'md',
  showLabel = true,
  label = 'Confidence',
  className = '',
  animated = true,
}) => {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(100, Math.max(0, value));
  
  // Spring animation for smooth value transitions
  const springValue = useSpring(0, {
    stiffness: 100,
    damping: 20,
  });

  useEffect(() => {
    if (animated) {
      springValue.set(clampedValue);
    }
  }, [clampedValue, springValue, animated]);

  // Size configurations
  const sizeConfig = {
    sm: { width: 80, strokeWidth: 6, fontSize: 'text-lg', labelSize: 'text-xs' },
    md: { width: 120, strokeWidth: 8, fontSize: 'text-2xl', labelSize: 'text-sm' },
    lg: { width: 160, strokeWidth: 10, fontSize: 'text-3xl', labelSize: 'text-base' },
  };

  const config = sizeConfig[size];
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate stroke dash offset for the progress arc
  const strokeDashoffset = useTransform(
    springValue,
    [0, 100],
    [circumference, 0]
  );

  // Get color based on confidence level
  const getColor = (val: number): string => {
    if (val >= 80) return '#10B981'; // Green - High confidence
    if (val >= 60) return '#00F5FF'; // Cyan - Good confidence
    if (val >= 40) return '#F59E0B'; // Amber - Medium confidence
    if (val >= 20) return '#F97316'; // Orange - Low confidence
    return '#EF4444'; // Red - Very low confidence
  };

  const color = getColor(clampedValue);
  // Transform for display value
  const displayNumber = useTransform(springValue, (latest: number) => 
    Math.round(latest)
  );

  return (
    <div 
      className={`relative inline-flex flex-col items-center ${className}`}
      role="meter"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${clampedValue}%`}
    >
      <svg
        width={config.width}
        height={config.width}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={config.strokeWidth}
        />
        
        {/* Animated progress circle */}
        <motion.circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
          className="transition-colors duration-300"
          filter="drop-shadow(0 0 8px currentColor)"
        />

        {/* Glow effect */}
        <defs>
          <filter id={`glow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Center value display */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ width: config.width, height: config.width }}
      >
        <motion.span 
          className={`font-bold ${config.fontSize} financial-value`}
          style={{ color }}
        >
          {animated ? (
            <motion.span>{displayNumber}</motion.span>
          ) : (
            Math.round(clampedValue)
          )}
          <span className="text-sm ml-0.5">%</span>
        </motion.span>
      </div>

      {/* Label */}
      {showLabel && (
        <span className={`mt-2 ${config.labelSize} text-slate-400 font-medium uppercase tracking-wider`}>
          {label}
        </span>
      )}
    </div>
  );
};

/**
 * Mini Confidence Indicator
 * Compact inline confidence display
 */
interface MiniConfidenceProps {
  value: number;
  className?: string;
}

export const MiniConfidence: React.FC<MiniConfidenceProps> = ({
  value,
  className = '',
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));
  
  const getColorClass = (val: number): string => {
    if (val >= 80) return 'bg-emerald-500';
    if (val >= 60) return 'bg-neon-cyan';
    if (val >= 40) return 'bg-amber-500';
    if (val >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${getColorClass(clampedValue)}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 font-medium tabular-nums">
        {clampedValue}%
      </span>
    </div>
  );
};

/**
 * Confidence Badge
 * Pill-style confidence indicator
 */
interface ConfidenceBadgeProps {
  value: number;
  label?: string;
  className?: string;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  value,
  label,
  className = '',
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));
  
  const getStyles = (val: number) => {
    if (val >= 80) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    if (val >= 60) return { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' };
    if (val >= 40) return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' };
    if (val >= 20) return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' };
    return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
  };

  const styles = getStyles(clampedValue);

  return (
    <span 
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
        ${styles.bg} ${styles.text} border ${styles.border}
        ${className}
      `}
    >
      {label && <span className="uppercase tracking-wider">{label}</span>}
      <span className="tabular-nums">{clampedValue}%</span>
    </span>
  );
};

export default ConfidenceGauge;
