/**
 * useGuardrails Hook
 * 
 * React hook for applying guardrails validation in components.
 * Provides validation, sanitization, and error handling.
 * 
 * @author Roneira AI
 * @version 2026
 */

import { useState, useCallback, useMemo } from 'react';
import {
  validatePortfolio,
  validatePortfolioItem,
  validatePrediction,
  sanitizeTicker,
  sanitizeNumber,
  isPortfolioValueValid,
  isSharesCountValid,
  isPriceValid,
  clampValue,
  apiRateLimiter,
  violationLogger,
  ValidationResult,
  GuardrailViolation,
} from '../utils/guardrails';

interface UseGuardrailsOptions {
  enableLogging?: boolean;
  onViolation?: (violation: GuardrailViolation) => void;
}

interface UseGuardrailsReturn {
  // Validation
  validatePortfolio: typeof validatePortfolio;
  validatePortfolioItem: typeof validatePortfolioItem;
  validatePrediction: typeof validatePrediction;
  
  // Sanitization
  sanitizeTicker: typeof sanitizeTicker;
  sanitizeNumber: typeof sanitizeNumber;
  
  // Bounds checking
  isPortfolioValueValid: typeof isPortfolioValueValid;
  isSharesCountValid: typeof isSharesCountValid;
  isPriceValid: typeof isPriceValid;
  clampValue: typeof clampValue;
  
  // Utilities
  wrapWithGuardrails: <T>(value: T, validator: (v: T) => ValidationResult<T>) => T | null;
  checkRateLimit: (key: string) => boolean;
  
  // State
  lastValidationError: string | null;
  violations: GuardrailViolation[];
  clearViolations: () => void;
}

export const useGuardrails = (options: UseGuardrailsOptions = {}): UseGuardrailsReturn => {
  const { enableLogging = true, onViolation } = options;
  
  const [lastValidationError, setLastValidationError] = useState<string | null>(null);
  const [violations, setViolations] = useState<GuardrailViolation[]>([]);

  // Log violation
  const logViolation = useCallback((violation: Omit<GuardrailViolation, 'timestamp'>) => {
    const fullViolation: GuardrailViolation = {
      ...violation,
      timestamp: new Date(),
    };
    
    if (enableLogging) {
      violationLogger.log(violation);
    }
    
    setViolations(prev => [...prev.slice(-50), fullViolation]);
    onViolation?.(fullViolation);
  }, [enableLogging, onViolation]);

  // Wrap validation with logging
  const wrappedValidatePortfolio = useCallback((data: unknown) => {
    const result = validatePortfolio(data);
    if (!result.success) {
      setLastValidationError(result.errors?.join(', ') || 'Validation failed');
      logViolation({
        type: 'validation',
        message: 'Portfolio validation failed',
        value: data,
      });
    } else {
      setLastValidationError(null);
    }
    return result;
  }, [logViolation]);

  const wrappedValidatePortfolioItem = useCallback((data: unknown) => {
    const result = validatePortfolioItem(data);
    if (!result.success) {
      setLastValidationError(result.errors?.join(', ') || 'Validation failed');
      logViolation({
        type: 'validation', 
        message: 'Portfolio item validation failed',
        value: data,
      });
    } else {
      setLastValidationError(null);
    }
    return result;
  }, [logViolation]);

  const wrappedValidatePrediction = useCallback((data: unknown) => {
    const result = validatePrediction(data);
    if (!result.success) {
      setLastValidationError(result.errors?.join(', ') || 'Validation failed');
      logViolation({
        type: 'validation',
        message: 'Prediction validation failed',
        value: data,
      });
    } else {
      setLastValidationError(null);
    }
    return result;
  }, [logViolation]);

  // Generic wrapper for applying guardrails
  const wrapWithGuardrails = useCallback(<T,>(
    value: T,
    validator: (v: T) => ValidationResult<T>
  ): T | null => {
    const result = validator(value);
    if (result.success && result.data !== undefined) {
      return result.data;
    }
    logViolation({
      type: 'validation',
      message: result.errors?.join(', ') || 'Validation failed',
      value,
    });
    return null;
  }, [logViolation]);

  // Rate limit check with logging
  const checkRateLimit = useCallback((key: string): boolean => {
    const allowed = apiRateLimiter.isAllowed(key);
    if (!allowed) {
      logViolation({
        type: 'rate_limit',
        message: `Rate limit exceeded for ${key}`,
      });
    }
    return allowed;
  }, [logViolation]);

  // Wrapped bounds checking with logging
  const wrappedIsPortfolioValueValid = useCallback((value: number) => {
    const valid = isPortfolioValueValid(value);
    if (!valid) {
      logViolation({
        type: 'bounds',
        field: 'portfolioValue',
        message: 'Portfolio value out of bounds',
        value,
      });
    }
    return valid;
  }, [logViolation]);

  const wrappedIsSharesCountValid = useCallback((shares: number) => {
    const valid = isSharesCountValid(shares);
    if (!valid) {
      logViolation({
        type: 'bounds',
        field: 'shares',
        message: 'Shares count out of bounds',
        value: shares,
      });
    }
    return valid;
  }, [logViolation]);

  const wrappedIsPriceValid = useCallback((price: number) => {
    const valid = isPriceValid(price);
    if (!valid) {
      logViolation({
        type: 'bounds',
        field: 'price',
        message: 'Price out of bounds',
        value: price,
      });
    }
    return valid;
  }, [logViolation]);

  // Wrapped sanitization with logging
  const wrappedSanitizeTicker = useCallback((ticker: string) => {
    const sanitized = sanitizeTicker(ticker);
    if (sanitized !== ticker.toUpperCase()) {
      logViolation({
        type: 'sanitization',
        field: 'ticker',
        message: 'Ticker was sanitized',
        value: { original: ticker, sanitized },
      });
    }
    return sanitized;
  }, [logViolation]);

  const clearViolations = useCallback(() => {
    setViolations([]);
    violationLogger.clear();
  }, []);

  return useMemo(() => ({
    validatePortfolio: wrappedValidatePortfolio,
    validatePortfolioItem: wrappedValidatePortfolioItem,
    validatePrediction: wrappedValidatePrediction,
    sanitizeTicker: wrappedSanitizeTicker,
    sanitizeNumber,
    isPortfolioValueValid: wrappedIsPortfolioValueValid,
    isSharesCountValid: wrappedIsSharesCountValid,
    isPriceValid: wrappedIsPriceValid,
    clampValue,
    wrapWithGuardrails,
    checkRateLimit,
    lastValidationError,
    violations,
    clearViolations,
  }), [
    wrappedValidatePortfolio,
    wrappedValidatePortfolioItem,
    wrappedValidatePrediction,
    wrappedSanitizeTicker,
    wrappedIsPortfolioValueValid,
    wrappedIsSharesCountValid,
    wrappedIsPriceValid,
    wrapWithGuardrails,
    checkRateLimit,
    lastValidationError,
    violations,
    clearViolations,
  ]);
};

export default useGuardrails;
