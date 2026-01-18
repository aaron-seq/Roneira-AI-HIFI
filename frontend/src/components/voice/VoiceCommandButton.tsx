/**
 * VoiceCommandButton Component
 * 
 * Microphone button for voice command activation.
 * Groww-inspired clean design with Royal Blue accent.
 * 
 * @author Roneira AI
 * @version 2026 Groww Theme
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2 } from 'lucide-react';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

interface VoiceCommandButtonProps {
  state: VoiceState;
  onToggle: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
  transcript?: string;
}

export const VoiceCommandButton: React.FC<VoiceCommandButtonProps> = ({
  state,
  onToggle,
  disabled = false,
  size = 'md',
  className = '',
  showLabel = true,
  transcript,
}) => {
  const sizeConfig = {
    sm: { button: 'w-10 h-10', icon: 'w-4 h-4', ring: 'w-12 h-12', label: 'text-xs' },
    md: { button: 'w-12 h-12', icon: 'w-5 h-5', ring: 'w-16 h-16', label: 'text-sm' },
    lg: { button: 'w-16 h-16', icon: 'w-6 h-6', ring: 'w-20 h-20', label: 'text-base' },
  };

  const config = sizeConfig[size];
  const isActive = state === 'listening';
  const isProcessing = state === 'processing';
  const isError = state === 'error';

  const getStateLabel = () => {
    switch (state) {
      case 'listening': return 'Listening...';
      case 'processing': return 'Processing...';
      case 'error': return 'Error - Try again';
      default: return 'Voice Command';
    }
  };

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      {/* Pulse rings (visible when listening) */}
      <AnimatePresence>
        {isActive && (
          <>
            {[1, 2, 3].map((ring) => (
              <motion.div
                key={ring}
                className={`absolute ${config.ring} rounded-full border-2 border-primary`}
                initial={{ opacity: 0.5, scale: 1 }}
                animate={{
                  opacity: 0,
                  scale: 2,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: ring * 0.3,
                  ease: 'easeOut',
                }}
                style={{
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        onClick={onToggle}
        disabled={disabled || isProcessing}
        className={`
          relative ${config.button} rounded-full
          flex items-center justify-center
          transition-all duration-200 focus-ring
          ${disabled 
            ? 'bg-slate-200 cursor-not-allowed text-slate-400' 
            : isActive 
              ? 'bg-primary text-white shadow-button'
              : isError
                ? 'bg-danger text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary'
          }
        `}
        whileHover={!disabled && !isProcessing ? { scale: 1.05 } : {}}
        whileTap={!disabled && !isProcessing ? { scale: 0.95 } : {}}
        aria-label={isActive ? 'Stop listening' : 'Start voice command'}
        aria-pressed={isActive}
      >
        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0, rotate: 0 }}
              animate={{ opacity: 1, rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{ rotate: { duration: 1, repeat: Infinity, ease: 'linear' } }}
            >
              <Loader2 className={`${config.icon} text-primary`} />
            </motion.div>
          ) : isError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <MicOff className={`${config.icon} text-white`} />
            </motion.div>
          ) : (
            <motion.div
              key="mic"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <Mic className={`${config.icon} ${isActive ? 'text-white' : ''}`} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Label */}
      {showLabel && (
        <motion.span
          className={`mt-2 ${config.label} font-medium ${
            isActive ? 'text-primary' : isError ? 'text-danger' : 'text-text-muted'
          }`}
          animate={isActive ? { opacity: [1, 0.7, 1] } : {}}
          transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
        >
          {getStateLabel()}
        </motion.span>
      )}

      {/* Live transcript display */}
      <AnimatePresence>
        {transcript && isActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-4 px-4 py-2 rounded-xl bg-white shadow-soft border border-slate-100 max-w-[250px]"
          >
            <p className="text-sm text-text-main text-center">"{transcript}"</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Compact voice button variant for toolbar use
 */
interface CompactVoiceButtonProps {
  state: VoiceState;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

export const CompactVoiceButton: React.FC<CompactVoiceButtonProps> = ({
  state,
  onToggle,
  disabled = false,
  className = '',
}) => {
  const isActive = state === 'listening';
  const isProcessing = state === 'processing';

  return (
    <motion.button
      onClick={onToggle}
      disabled={disabled || isProcessing}
      className={`
        relative p-2 rounded-xl transition-all duration-200
        ${isActive 
          ? 'bg-primary/10 text-primary' 
          : 'text-text-muted hover:text-primary hover:bg-slate-100'
        }
        ${className}
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={isActive ? 'Stop listening' : 'Voice command'}
    >
      {isProcessing ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
      
      {/* Active indicator dot */}
      {isActive && (
        <motion.span
          className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
};

export default VoiceCommandButton;
