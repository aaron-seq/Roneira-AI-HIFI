/**
 * SkeletonLoader Component
 * 
 * Enhanced skeleton loading states with shimmer effect.
 * Matches exact content dimensions for seamless loading experience.
 * 
 * @author Roneira AI
 * @version 2026
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

/**
 * Base Skeleton Component
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
}) => {
  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || '1rem',
  };

  return (
    <div
      className={`skeleton ${className}`}
      style={style}
      aria-hidden="true"
      role="presentation"
    />
  );
};

/**
 * Skeleton Text - For text placeholders
 */
interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 1,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height="1rem"
          width={index === lines - 1 && lines > 1 ? '60%' : '100%'}
          className="skeleton-text"
        />
      ))}
    </div>
  );
};

/**
 * Skeleton Title - For heading placeholders
 */
export const SkeletonTitle: React.FC<SkeletonProps> = ({ className = '' }) => {
  return <Skeleton height="1.5rem" width="75%" className={`skeleton-title ${className}`} />;
};

/**
 * Skeleton Card - For card placeholders
 */
interface SkeletonCardProps {
  className?: string;
  hasHeader?: boolean;
  hasFooter?: boolean;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  className = '',
  hasHeader = true,
  hasFooter = false,
}) => {
  return (
    <div className={`glass-card p-6 space-y-4 ${className}`}>
      {hasHeader && (
        <div className="flex items-center justify-between">
          <SkeletonTitle />
          <Skeleton width="2rem" height="2rem" className="rounded-full" />
        </div>
      )}
      <div className="space-y-3">
        <SkeletonText lines={3} />
      </div>
      {hasFooter && (
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <Skeleton width="5rem" height="2rem" className="rounded-lg" />
          <Skeleton width="5rem" height="2rem" className="rounded-lg" />
        </div>
      )}
    </div>
  );
};

/**
 * Skeleton Chart - For chart placeholders
 */
interface SkeletonChartProps {
  className?: string;
  height?: string | number;
}

export const SkeletonChart: React.FC<SkeletonChartProps> = ({
  className = '',
  height = '16rem',
}) => {
  return (
    <div className={`chart-container ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <SkeletonTitle />
        <div className="flex gap-2">
          <Skeleton width="4rem" height="1.5rem" className="rounded" />
          <Skeleton width="4rem" height="1.5rem" className="rounded" />
        </div>
      </div>
      <Skeleton height={height} className="skeleton-chart rounded-xl" />
    </div>
  );
};

/**
 * Skeleton Table - For table placeholders
 */
interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 4,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b border-white/10">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton
            key={`header-${index}`}
            height="1rem"
            width={index === 0 ? '30%' : '15%'}
            className="rounded"
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 py-3">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              height="1rem"
              width={colIndex === 0 ? '30%' : '15%'}
              className="rounded"
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton Prediction Card - Matches PredictionCard layout
 */
export const SkeletonPredictionCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`prediction-card p-5 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Skeleton width="4rem" height="1.5rem" className="rounded" />
        <Skeleton width="5rem" height="1.5rem" className="rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton width="100%" height="2rem" className="rounded" />
        <div className="flex justify-between">
          <Skeleton width="40%" height="1rem" className="rounded" />
          <Skeleton width="30%" height="1rem" className="rounded" />
        </div>
      </div>
      <Skeleton width="100%" height="3rem" className="rounded-lg" />
    </div>
  );
};

/**
 * Skeleton Metric - For metric/stat placeholders
 */
export const SkeletonMetric: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <Skeleton width="60%" height="0.75rem" className="rounded" />
      <Skeleton width="80%" height="1.75rem" className="rounded" />
      <Skeleton width="40%" height="0.625rem" className="rounded" />
    </div>
  );
};

/**
 * Progressive Skeleton Container
 * Reveals children progressively from top to bottom
 */
interface ProgressiveSkeletonProps {
  isLoading: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export const ProgressiveSkeleton: React.FC<ProgressiveSkeletonProps> = ({
  isLoading,
  children,
  fallback,
  className = '',
}) => {
  if (isLoading) {
    return <div className={className}>{fallback || <SkeletonCard />}</div>;
  }

  return (
    <div className={`animate-fade-in ${className}`}>
      {children}
    </div>
  );
};

export default Skeleton;
