/**
 * RadialPortfolioMeter Component
 * 
 * Animated radial meter displaying total portfolio value.
 * Groww-inspired soft design with Royal Blue gradient.
 * 
 * @author Roneira AI
 * @version 2026 Groww Theme
 */

import React, { useEffect, useMemo } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface RadialPortfolioMeterProps {
  value: number;
  maxValue?: number;
  previousValue?: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showChange?: boolean;
  animated?: boolean;
}

export const RadialPortfolioMeter: React.FC<RadialPortfolioMeterProps> = ({
  value,
  maxValue = value * 1.5,
  previousValue,
  currency = '₹',
  size = 'lg',
  className = '',
  showChange = true,
  animated = true,
}) => {
  // Size configurations
  const sizeConfig = {
    sm: { width: 140, strokeWidth: 10, fontSize: 'text-xl', labelSize: 'text-xs', changeSize: 'text-sm' },
    md: { width: 200, strokeWidth: 14, fontSize: 'text-3xl', labelSize: 'text-sm', changeSize: 'text-base' },
    lg: { width: 260, strokeWidth: 18, fontSize: 'text-4xl', labelSize: 'text-base', changeSize: 'text-lg' },
    xl: { width: 320, strokeWidth: 22, fontSize: 'text-5xl', labelSize: 'text-lg', changeSize: 'text-xl' },
  };

  const config = sizeConfig[size];
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate percentage for arc
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));

  // Spring animation for smooth value transitions
  const springValue = useSpring(0, {
    stiffness: 80,
    damping: 25,
  });

  const springPercentage = useSpring(0, {
    stiffness: 60,
    damping: 20,
  });

  useEffect(() => {
    if (animated) {
      springValue.set(value);
      springPercentage.set(percentage);
    }
  }, [value, percentage, springValue, springPercentage, animated]);

  // Transform for stroke dash offset
  const strokeDashoffset = useTransform(
    springPercentage,
    [0, 100],
    [circumference, circumference * 0.15]
  );

  // Calculate change percentage
  const changePercent = useMemo(() => {
    if (!previousValue || previousValue === 0) return 0;
    return ((value - previousValue) / previousValue) * 100;
  }, [value, previousValue]);

  const isPositive = changePercent >= 0;

  // Format currency value
  const formatValue = (val: number): string => {
    if (val >= 10000000) return `${currency}${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `${currency}${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `${currency}${(val / 1000).toFixed(1)}K`;
    return `${currency}${val.toFixed(0)}`;
  };

  // Groww-inspired gradient colors
  const primaryColor = '#5076EE';
  const secondaryColor = '#00D09C';
  const gradientId = `portfolio-gradient-${size}`;

  return (
    <div 
      className={`relative inline-flex flex-col items-center ${className}`}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={maxValue}
      aria-label={`Portfolio value: ${formatValue(value)}`}
    >
      <svg
        width={config.width}
        height={config.width}
        className="transform -rotate-90"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="100%" stopColor={secondaryColor} />
          </linearGradient>
        </defs>

        {/* Background ring */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke="#E8EAED"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
        />

        {/* Subtle tick marks */}
        {[...Array(12)].map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const innerRadius = radius - config.strokeWidth / 2 - 8;
          const outerRadius = radius - config.strokeWidth / 2 - 4;
          const x1 = config.width / 2 + innerRadius * Math.cos(angle);
          const y1 = config.width / 2 + innerRadius * Math.sin(angle);
          const x2 = config.width / 2 + outerRadius * Math.cos(angle);
          const y2 = config.width / 2 + outerRadius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#E8EAED"
              strokeWidth="1"
            />
          );
        })}

        {/* Animated progress arc */}
        <motion.circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
        />
      </svg>

      {/* Center content */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ width: config.width, height: config.width }}
      >
        {/* Portfolio Value */}
        <motion.span 
          className={`font-semibold ${config.fontSize} text-text-main`}
        >
          {animated ? (
            <motion.span>
              {useTransform(springValue, (latest: number) => formatValue(latest))}
            </motion.span>
          ) : (
            formatValue(value)
          )}
        </motion.span>

        {/* Label */}
        <span className={`${config.labelSize} text-text-muted font-medium mt-1`}>
          Total Investment
        </span>

        {/* Change indicator */}
        {showChange && previousValue !== undefined && (
          <div 
            className={`flex items-center gap-1 mt-2 px-3 py-1 rounded-full ${config.changeSize} font-medium`}
            style={{ 
              backgroundColor: isPositive ? '#E5F7EE' : '#FDEEEA',
              color: isPositive ? '#00D09C' : '#EB5B3C'
            }}
          >
            <span>{isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(changePercent).toFixed(2)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RadialPortfolioMeter;
