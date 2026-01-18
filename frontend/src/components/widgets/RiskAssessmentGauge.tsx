/**
 * RiskAssessmentGauge Component
 * 
 * Semicircle gauge displaying portfolio risk level.
 * Groww-inspired clean design with soft colors.
 * 
 * @author Roneira AI
 * @version 2026 Groww Theme
 */

import React, { useEffect, useMemo } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Shield, AlertTriangle, Flame } from 'lucide-react';

interface RiskAssessmentGaugeProps {
  riskScore: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
  animated?: boolean;
}

type RiskLevel = 'conservative' | 'moderate' | 'balanced' | 'growth' | 'aggressive';

interface RiskConfig {
  level: RiskLevel;
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  description: string;
}

const getRiskConfig = (score: number): RiskConfig => {
  if (score <= 20) {
    return {
      level: 'conservative',
      label: 'Conservative',
      color: '#00D09C',
      bgColor: '#E5F7EE',
      icon: <Shield className="w-4 h-4" />,
      description: 'Low risk, stable investments. Suitable for capital preservation.',
    };
  }
  if (score <= 40) {
    return {
      level: 'moderate',
      label: 'Moderate',
      color: '#5076EE',
      bgColor: '#EEF2FD',
      icon: <Shield className="w-4 h-4" />,
      description: 'Balanced approach with some growth potential.',
    };
  }
  if (score <= 60) {
    return {
      level: 'balanced',
      label: 'Balanced',
      color: '#F59E0B',
      bgColor: '#FEF3C7',
      icon: <AlertTriangle className="w-4 h-4" />,
      description: 'Equal mix of stability and growth opportunities.',
    };
  }
  if (score <= 80) {
    return {
      level: 'growth',
      label: 'Growth',
      color: '#F97316',
      bgColor: '#FFEDD5',
      icon: <AlertTriangle className="w-4 h-4" />,
      description: 'Higher risk for potentially higher returns.',
    };
  }
  return {
    level: 'aggressive',
    label: 'Aggressive',
    color: '#EB5B3C',
    bgColor: '#FDEEEA',
    icon: <Flame className="w-4 h-4" />,
    description: 'Maximum risk tolerance. Volatile investments.',
  };
};

export const RiskAssessmentGauge: React.FC<RiskAssessmentGaugeProps> = ({
  riskScore,
  size = 'md',
  showTooltip = true,
  className = '',
  animated = true,
}) => {
  const clampedScore = Math.min(100, Math.max(0, riskScore));
  const riskConfig = useMemo(() => getRiskConfig(clampedScore), [clampedScore]);

  // Size configurations
  const sizeConfig = {
    sm: { width: 160, height: 90, strokeWidth: 12, fontSize: 'text-sm', labelSize: 'text-xs' },
    md: { width: 240, height: 130, strokeWidth: 16, fontSize: 'text-lg', labelSize: 'text-sm' },
    lg: { width: 320, height: 175, strokeWidth: 20, fontSize: 'text-xl', labelSize: 'text-base' },
  };

  const config = sizeConfig[size];
  const radius = (config.width - config.strokeWidth) / 2 - 10;
  const centerX = config.width / 2;
  const centerY = config.height - 10;

  // Spring animation for needle
  const springAngle = useSpring(0, {
    stiffness: 50,
    damping: 15,
  });

  useEffect(() => {
    if (animated) {
      const angle = (clampedScore / 100) * 180 - 90;
      springAngle.set(angle);
    }
  }, [clampedScore, springAngle, animated]);

  const needleRotation = useTransform(springAngle, (angle) => `rotate(${angle}deg)`);

  // Generate arc path for semicircle segments
  const createArcPath = (startAngle: number, endAngle: number): string => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
  };

  // Segment configurations with Groww-inspired colors
  const segments = [
    { start: -180, end: -144, color: '#00D09C' }, // Conservative - Green
    { start: -144, end: -108, color: '#5076EE' }, // Moderate - Blue
    { start: -108, end: -72, color: '#F59E0B' },  // Balanced - Yellow
    { start: -72, end: -36, color: '#F97316' },   // Growth - Orange
    { start: -36, end: 0, color: '#EB5B3C' },     // Aggressive - Red
  ];

  return (
    <div 
      className={`relative inline-flex flex-col items-center ${className}`}
      role="meter"
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Portfolio risk: ${riskConfig.label}`}
    >
      <svg width={config.width} height={config.height} className="overflow-visible">
        {/* Background arc */}
        <path
          d={createArcPath(-180, 0)}
          fill="none"
          stroke="#E8EAED"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
        />

        {/* Colored segments */}
        {segments.map((segment, index) => (
          <path
            key={index}
            d={createArcPath(segment.start, segment.end)}
            fill="none"
            stroke={segment.color}
            strokeWidth={config.strokeWidth - 4}
            strokeLinecap="butt"
            opacity={0.7}
          />
        ))}

        {/* Active segment highlight */}
        <path
          d={createArcPath(
            -180,
            -180 + (clampedScore / 100) * 180
          )}
          fill="none"
          stroke={riskConfig.color}
          strokeWidth={config.strokeWidth - 2}
          strokeLinecap="round"
        />

        {/* Needle pivot point */}
        <circle
          cx={centerX}
          cy={centerY}
          r={8}
          fill={riskConfig.color}
        />
        <circle
          cx={centerX}
          cy={centerY}
          r={5}
          fill="white"
        />

        {/* Animated needle */}
        <motion.g
          style={{ 
            transformOrigin: `${centerX}px ${centerY}px`,
            transform: needleRotation 
          }}
        >
          <line
            x1={centerX}
            y1={centerY}
            x2={centerX}
            y2={centerY - radius + 15}
            stroke={riskConfig.color}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle
            cx={centerX}
            cy={centerY - radius + 15}
            r={4}
            fill={riskConfig.color}
          />
        </motion.g>

        {/* Scale labels */}
        <text x={15} y={centerY - 5} className="text-xs" fill="#7C7E8C">Low</text>
        <text x={config.width - 35} y={centerY - 5} className="text-xs" fill="#7C7E8C">High</text>
      </svg>

      {/* Risk level display */}
      <div className="flex flex-col items-center mt-2">
        <div 
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ backgroundColor: riskConfig.bgColor }}
        >
          <span style={{ color: riskConfig.color }}>{riskConfig.icon}</span>
          <span 
            className={`font-semibold ${config.fontSize}`}
            style={{ color: riskConfig.color }}
          >
            {riskConfig.label}
          </span>
        </div>
        
        <span className={`text-text-muted ${config.labelSize} mt-1 tabular-nums`}>
          Risk Score: {clampedScore}
        </span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="mt-3 max-w-[200px] text-center">
          <p className="text-xs text-text-muted">{riskConfig.description}</p>
        </div>
      )}
    </div>
  );
};

export default RiskAssessmentGauge;
