/**
 * MLPredictionOverlay Component
 * 
 * Visualization layer for ML predictions with confidence cone.
 * Shows prediction range with ±1σ and ±2σ bands.
 * 
 * @author Roneira AI
 * @version 2026
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface PredictionPoint {
  date: string;
  predicted: number;
  confidence: number; // 0-100
  upperBound1Sigma: number;
  lowerBound1Sigma: number;
  upperBound2Sigma?: number;
  lowerBound2Sigma?: number;
}

interface MLPredictionOverlayProps {
  predictions: PredictionPoint[];
  width: number;
  xScale: (date: string) => number;
  yScale: (value: number) => number;
  visible?: boolean;
  showConfidenceBands?: boolean;
  className?: string;
}

export const MLPredictionOverlay: React.FC<MLPredictionOverlayProps> = ({
  predictions,
  width,
  xScale,
  yScale,
  visible = true,
  showConfidenceBands = true,
  className = '',
}) => {
  // Generate path data for prediction line
  const predictionLinePath = useMemo(() => {
    if (predictions.length === 0) return '';
    return predictions.map((point, index) => {
      const x = xScale(point.date);
      const y = yScale(point.predicted);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [predictions, xScale, yScale]);

  // Generate confidence cone paths (1σ band)
  const confidenceCone1SigmaPath = useMemo(() => {
    if (predictions.length === 0) return '';
    
    const upperPath = predictions.map((point, index) => {
      const x = xScale(point.date);
      const y = yScale(point.upperBound1Sigma);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const lowerPath = [...predictions].reverse().map((point, index) => {
      const x = xScale(point.date);
      const y = yScale(point.lowerBound1Sigma);
      return `${index === 0 ? 'L' : 'L'} ${x} ${y}`;
    }).join(' ');

    return `${upperPath} ${lowerPath} Z`;
  }, [predictions, xScale, yScale]);

  // Generate confidence cone paths (2σ band)
  const confidenceCone2SigmaPath = useMemo(() => {
    if (predictions.length === 0 || !predictions[0].upperBound2Sigma) return '';
    
    const upperPath = predictions.map((point, index) => {
      const x = xScale(point.date);
      const y = yScale(point.upperBound2Sigma || point.upperBound1Sigma * 1.2);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const lowerPath = [...predictions].reverse().map((point, index) => {
      const x = xScale(point.date);
      const y = yScale(point.lowerBound2Sigma || point.lowerBound1Sigma * 0.8);
      return `${index === 0 ? 'L' : 'L'} ${x} ${y}`;
    }).join(' ');

    return `${upperPath} ${lowerPath} Z`;
  }, [predictions, xScale, yScale]);

  // Calculate average confidence for opacity
  const avgConfidence = useMemo(() => {
    if (predictions.length === 0) return 0;
    return predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
  }, [predictions]);

  if (!visible || predictions.length === 0) return null;

  return (
    <motion.g
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <defs>
        {/* Gradient for confidence cone */}
        <linearGradient id="prediction-cone-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B026FF" stopOpacity={0.4 * (avgConfidence / 100)} />
          <stop offset="50%" stopColor="#B026FF" stopOpacity={0.1 * (avgConfidence / 100)} />
          <stop offset="100%" stopColor="#B026FF" stopOpacity={0.4 * (avgConfidence / 100)} />
        </linearGradient>

        <linearGradient id="prediction-cone-2sigma-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B026FF" stopOpacity={0.15 * (avgConfidence / 100)} />
          <stop offset="50%" stopColor="#B026FF" stopOpacity={0.05 * (avgConfidence / 100)} />
          <stop offset="100%" stopColor="#B026FF" stopOpacity={0.15 * (avgConfidence / 100)} />
        </linearGradient>

        {/* Glow filter for prediction line */}
        <filter id="prediction-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 2σ confidence band (outer) */}
      {showConfidenceBands && confidenceCone2SigmaPath && (
        <motion.path
          d={confidenceCone2SigmaPath}
          fill="url(#prediction-cone-2sigma-gradient)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      )}

      {/* 1σ confidence band (inner) */}
      {showConfidenceBands && (
        <motion.path
          d={confidenceCone1SigmaPath}
          fill="url(#prediction-cone-gradient)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        />
      )}

      {/* Prediction line (dashed) */}
      <motion.path
        d={predictionLinePath}
        fill="none"
        stroke="#B026FF"
        strokeWidth="2"
        strokeDasharray="8 4"
        strokeLinecap="round"
        filter="url(#prediction-glow)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />

      {/* Prediction points */}
      {predictions.map((point, index) => {
        const x = xScale(point.date);
        const y = yScale(point.predicted);
        return (
          <motion.g key={point.date}>
            {/* Outer ring */}
            <motion.circle
              cx={x}
              cy={y}
              r={6}
              fill="transparent"
              stroke="#B026FF"
              strokeWidth="1"
              opacity={0.5}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + index * 0.1 }}
            />
            {/* Inner dot */}
            <motion.circle
              cx={x}
              cy={y}
              r={3}
              fill="#B026FF"
              filter="url(#prediction-glow)"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + index * 0.1, type: 'spring' }}
            />
          </motion.g>
        );
      })}

      {/* Label */}
      <motion.g
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <rect
          x={width - 120}
          y={10}
          width={110}
          height={30}
          rx={6}
          fill="rgba(176, 38, 255, 0.2)"
          stroke="rgba(176, 38, 255, 0.4)"
          strokeWidth={1}
        />
        <text
          x={width - 65}
          y={30}
          textAnchor="middle"
          className="text-xs fill-purple-400 font-semibold"
        >
          ML Prediction
        </text>
      </motion.g>
    </motion.g>
  );
};

/**
 * Hook to generate prediction data from ML service response
 */
export const usePredictionData = (
  predictions: Array<{ date: string; predicted: number; confidence: number }>,
  volatility: number = 0.05
): PredictionPoint[] => {
  return useMemo(() => {
    return predictions.map((p, index) => {
      // Increase uncertainty over time
      const timeMultiplier = 1 + (index * 0.1);
      const sigma1 = p.predicted * volatility * timeMultiplier;
      const sigma2 = sigma1 * 1.5;

      return {
        date: p.date,
        predicted: p.predicted,
        confidence: p.confidence,
        upperBound1Sigma: p.predicted + sigma1,
        lowerBound1Sigma: p.predicted - sigma1,
        upperBound2Sigma: p.predicted + sigma2,
        lowerBound2Sigma: p.predicted - sigma2,
      };
    });
  }, [predictions, volatility]);
};

export default MLPredictionOverlay;
