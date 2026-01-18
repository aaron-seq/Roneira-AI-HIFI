/**
 * AnimatedNumber Component
 * 
 * Smooth number counter with spring physics for real-time price updates.
 * Features color flash on significant changes and configurable formatting.
 * 
 * @author Roneira AI
 * @version 2026
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  precision?: number;
  highlightChange?: boolean;
  highlightThreshold?: number; // Percentage change to trigger highlight
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showDirection?: boolean;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  prefix = '',
  suffix = '',
  precision = 2,
  highlightChange = true,
  highlightThreshold = 0.5,
  className = '',
  size = 'md',
  showDirection = false,
}) => {
  const previousValue = useRef(value);
  const [flashClass, setFlashClass] = useState('');
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);

  // Spring animation for smooth number transitions
  const spring = useSpring(value, {
    stiffness: 180,
    damping: 12,
    mass: 1,
  });

  // Transform spring value to formatted string
  const displayValue = useTransform(spring, (latest) => {
    return latest.toFixed(precision);
  });

  // Handle value changes
  useEffect(() => {
    spring.set(value);

    if (highlightChange && previousValue.current !== value) {
      const percentChange = Math.abs((value - previousValue.current) / previousValue.current) * 100;
      
      if (percentChange >= highlightThreshold) {
        const isUp = value > previousValue.current;
        setDirection(isUp ? 'up' : 'down');
        setFlashClass(isUp ? 'number-flash-up' : 'number-flash-down');
        
        // Clear flash class after animation
        const timer = setTimeout(() => {
          setFlashClass('');
        }, 500);
        
        return () => clearTimeout(timer);
      }
    }
    
    previousValue.current = value;
  }, [value, spring, highlightChange, highlightThreshold]);

  // Size classes
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-3xl',
  };

  // Direction indicator
  const directionIndicator = showDirection && direction && (
    <span 
      className={`ml-1 transition-opacity duration-300 ${
        direction === 'up' ? 'text-emerald-400' : 'text-red-400'
      }`}
    >
      {direction === 'up' ? '↑' : '↓'}
    </span>
  );

  return (
    <motion.span
      className={`
        financial-value inline-flex items-center rounded-md px-1
        ${sizeClasses[size]}
        ${flashClass}
        ${className}
      `}
    >
      {prefix && <span className="mr-0.5">{prefix}</span>}
      <motion.span>{displayValue}</motion.span>
      {suffix && <span className="ml-0.5">{suffix}</span>}
      {directionIndicator}
    </motion.span>
  );
};

/**
 * AnimatedPrice Component
 * 
 * Specialized version of AnimatedNumber for currency display
 */
interface AnimatedPriceProps {
  value: number;
  currency?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showChange?: boolean;
  previousValue?: number;
}

export const AnimatedPrice: React.FC<AnimatedPriceProps> = ({
  value,
  currency = '$',
  className = '',
  size = 'md',
  showChange = false,
  previousValue,
}) => {
  const change = previousValue !== undefined ? value - previousValue : 0;
  const changePercent = previousValue !== undefined && previousValue !== 0
    ? ((value - previousValue) / previousValue) * 100
    : 0;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <AnimatedNumber
        value={value}
        prefix={currency}
        precision={2}
        highlightChange={true}
        size={size}
        showDirection={true}
      />
      {showChange && previousValue !== undefined && (
        <span 
          className={`text-xs font-medium ${
            change >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {change >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
        </span>
      )}
    </div>
  );
};

/**
 * AnimatedPercentage Component
 * 
 * Animated percentage display with color coding
 */
interface AnimatedPercentageProps {
  value: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  colorCode?: boolean;
}

export const AnimatedPercentage: React.FC<AnimatedPercentageProps> = ({
  value,
  className = '',
  size = 'md',
  colorCode = true,
}) => {
  const colorClass = colorCode
    ? value > 0 
      ? 'text-emerald-400' 
      : value < 0 
        ? 'text-red-400' 
        : 'text-slate-400'
    : '';

  return (
    <AnimatedNumber
      value={value}
      prefix={value > 0 ? '+' : ''}
      suffix="%"
      precision={2}
      highlightChange={true}
      size={size}
      className={`${colorClass} ${className}`}
    />
  );
};

export default AnimatedNumber;
