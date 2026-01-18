import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export type ConnectionState = 'connected' | 'reconnecting' | 'stale' | 'disconnected';

interface ConnectionStatusProps {
  status: ConnectionState;
  lastTickTime?: Date;
  className?: string;
  showLabel?: boolean;
}

/**
 * ConnectionStatus - Real-time connection status indicator
 * Shows Connected (green), Reconnecting (yellow), Stale (red), or Disconnected states
 * Used primarily in watchlists and real-time data components
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  lastTickTime,
  className = '',
  showLabel = true,
}) => {
  const statusConfig = {
    connected: {
      icon: Wifi,
      label: 'Connected',
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-bg)',
      pulse: false,
    },
    reconnecting: {
      icon: RefreshCw,
      label: 'Reconnecting',
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-bg)',
      pulse: true,
    },
    stale: {
      icon: WifiOff,
      label: 'Stale',
      color: 'var(--color-danger)',
      bgColor: 'var(--color-danger-bg)',
      pulse: false,
    },
    disconnected: {
      icon: WifiOff,
      label: 'Disconnected',
      color: 'var(--text-3)',
      bgColor: 'rgba(253, 253, 252, 0.06)',
      pulse: false,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  const formatLastTick = (time?: Date) => {
    if (!time) return null;
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);
    
    if (diffSeconds < 5) return 'just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return time.toLocaleTimeString();
  };

  return (
    <div 
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${className}`}
      style={{ 
        backgroundColor: config.bgColor,
        border: `1px solid ${config.color}20`
      }}
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${config.label}`}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-2"
        >
          {/* Status Dot with optional pulse */}
          <div className="relative">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: config.color }}
              animate={config.pulse ? { scale: [1, 1.2, 1] } : {}}
              transition={config.pulse ? { 
                duration: 1.5, 
                repeat: Infinity,
                ease: 'easeInOut'
              } : {}}
            />
            {config.pulse && (
              <motion.div
                className="absolute inset-0 w-2 h-2 rounded-full"
                style={{ backgroundColor: config.color }}
                animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity,
                  ease: 'easeOut'
                }}
              />
            )}
          </div>

          {/* Icon */}
          <Icon 
            size={14} 
            style={{ color: config.color }}
            className={status === 'reconnecting' ? 'animate-spin' : ''}
          />

          {/* Label */}
          {showLabel && (
            <span 
              className="text-xs font-medium"
              style={{ color: config.color }}
            >
              {config.label}
            </span>
          )}

          {/* Last tick time (only for connected/stale) */}
          {lastTickTime && (status === 'connected' || status === 'stale') && showLabel && (
            <span 
              className="text-xs"
              style={{ color: 'var(--text-3)' }}
            >
              • {formatLastTick(lastTickTime)}
            </span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ConnectionStatus;
