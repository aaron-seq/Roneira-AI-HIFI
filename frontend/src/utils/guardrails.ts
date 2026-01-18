/**
 * Guardrails Utilities
 * 
 * Input validation, bounds checking, and safety measures for the application.
 * Provides runtime validation and sanitization.
 * 
 * @author Roneira AI
 * @version 2026
 */

import { z } from 'zod';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export interface GuardrailsConfig {
  maxPortfolioValue: number;
  minPortfolioValue: number;
  maxSharesPerPosition: number;
  maxPricePerShare: number;
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
}

// Default guardrails configuration
export const DEFAULT_GUARDRAILS_CONFIG: GuardrailsConfig = {
  maxPortfolioValue: 1000000000000, // 1 trillion (Cr for Indian context)
  minPortfolioValue: 0,
  maxSharesPerPosition: 10000000, // 1 crore shares
  maxPricePerShare: 10000000, // ₹1 crore per share
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  },
};

// ============================================
// ZOD SCHEMAS
// ============================================

export const TickerSchema = z.string()
  .min(1, 'Ticker cannot be empty')
  .max(20, 'Ticker too long')
  .regex(/^[A-Z0-9.-]+$/i, 'Invalid ticker format');

export const PriceSchema = z.number()
  .positive('Price must be positive')
  .max(DEFAULT_GUARDRAILS_CONFIG.maxPricePerShare, 'Price exceeds maximum');

export const SharesSchema = z.number()
  .positive('Shares must be positive')
  .max(DEFAULT_GUARDRAILS_CONFIG.maxSharesPerPosition, 'Shares exceed maximum');

export const PortfolioItemSchema = z.object({
  ticker: TickerSchema,
  shares: SharesSchema,
  avg_price: PriceSchema,
  name: z.string().optional(),
});

export const PortfolioSchema = z.array(PortfolioItemSchema);

export const PredictionSchema = z.object({
  ticker: TickerSchema,
  predicted_price: PriceSchema,
  confidence: z.number().min(0).max(100),
  prediction_date: z.string().datetime(),
  model_version: z.string().optional(),
});

export const APIResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
  error: z.string().optional(),
  timestamp: z.string().optional(),
});

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate portfolio data
 */
export function validatePortfolio(data: unknown): ValidationResult<z.infer<typeof PortfolioSchema>> {
  try {
    const result = PortfolioSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { 
      success: false, 
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  } catch (error) {
    return { success: false, errors: ['Invalid portfolio data format'] };
  }
}

/**
 * Validate single portfolio item
 */
export function validatePortfolioItem(data: unknown): ValidationResult<z.infer<typeof PortfolioItemSchema>> {
  try {
    const result = PortfolioItemSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { 
      success: false, 
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  } catch (error) {
    return { success: false, errors: ['Invalid portfolio item format'] };
  }
}

/**
 * Validate prediction data
 */
export function validatePrediction(data: unknown): ValidationResult<z.infer<typeof PredictionSchema>> {
  try {
    const result = PredictionSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { 
      success: false, 
      errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  } catch (error) {
    return { success: false, errors: ['Invalid prediction data format'] };
  }
}

// ============================================
// BOUNDS CHECKING
// ============================================

/**
 * Check if a portfolio value is within reasonable bounds
 */
export function isPortfolioValueValid(value: number, config = DEFAULT_GUARDRAILS_CONFIG): boolean {
  return value >= config.minPortfolioValue && value <= config.maxPortfolioValue;
}

/**
 * Check if shares count is valid
 */
export function isSharesCountValid(shares: number, config = DEFAULT_GUARDRAILS_CONFIG): boolean {
  return shares > 0 && shares <= config.maxSharesPerPosition;
}

/**
 * Check if price is valid
 */
export function isPriceValid(price: number, config = DEFAULT_GUARDRAILS_CONFIG): boolean {
  return price > 0 && price <= config.maxPricePerShare;
}

/**
 * Clamp a value within bounds
 */
export function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============================================
// SANITIZATION
// ============================================

/**
 * Sanitize ticker symbol
 */
export function sanitizeTicker(ticker: string): string {
  return ticker
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 20);
}

/**
 * Sanitize text input to prevent XSS
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input: string | number): number {
  const num = typeof input === 'string' ? parseFloat(input) : input;
  if (isNaN(num) || !isFinite(num)) return 0;
  return num;
}

// ============================================
// RATE LIMITING
// ============================================

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: GuardrailsConfig['rateLimit'];

  constructor(config = DEFAULT_GUARDRAILS_CONFIG.rateLimit) {
    this.config = config;
  }

  /**
   * Check if request is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Get existing requests for this key
    let requests = this.requests.get(key) || [];
    
    // Filter to only requests within the window
    requests = requests.filter(time => time > windowStart);
    
    // Check if under limit
    if (requests.length >= this.config.maxRequests) {
      return false;
    }
    
    // Add current request
    requests.push(now);
    this.requests.set(key, requests);
    
    return true;
  }

  /**
   * Get remaining requests
   */
  getRemainingRequests(key: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const requests = (this.requests.get(key) || []).filter(time => time > windowStart);
    return Math.max(0, this.config.maxRequests - requests.length);
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }
}

// Export singleton rate limiter
export const apiRateLimiter = new RateLimiter();
export const voiceRateLimiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });

// ============================================
// ERROR HANDLING
// ============================================

export class GuardrailError extends Error {
  constructor(
    message: string,
    public code: string,
    public field?: string
  ) {
    super(message);
    this.name = 'GuardrailError';
  }
}

/**
 * Create a safe wrapper for async functions
 */
export function withGuardrails<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  options: {
    rateLimit?: boolean;
    rateLimitKey?: string;
    validateResult?: (result: T) => boolean;
    fallback?: T;
  } = {}
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    // Rate limiting check
    if (options.rateLimit && options.rateLimitKey) {
      if (!apiRateLimiter.isAllowed(options.rateLimitKey)) {
        throw new GuardrailError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
      }
    }

    try {
      const result = await fn(...args);
      
      // Validate result if validator provided
      if (options.validateResult && !options.validateResult(result)) {
        if (options.fallback !== undefined) {
          return options.fallback;
        }
        throw new GuardrailError('Invalid result', 'VALIDATION_FAILED');
      }
      
      return result;
    } catch (error) {
      // If fallback provided, return it on error
      if (options.fallback !== undefined) {
        console.warn('Guardrails: Using fallback due to error:', error);
        return options.fallback;
      }
      throw error;
    }
  };
}

// ============================================
// LOGGING
// ============================================

export interface GuardrailViolation {
  type: 'validation' | 'bounds' | 'rate_limit' | 'sanitization';
  field?: string;
  message: string;
  timestamp: Date;
  value?: unknown;
}

class ViolationLogger {
  private violations: GuardrailViolation[] = [];
  private maxViolations = 100;

  log(violation: Omit<GuardrailViolation, 'timestamp'>): void {
    this.violations.push({
      ...violation,
      timestamp: new Date(),
    });

    // Keep only recent violations
    if (this.violations.length > this.maxViolations) {
      this.violations = this.violations.slice(-this.maxViolations);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Guardrails Violation]', violation);
    }
  }

  getViolations(): GuardrailViolation[] {
    return [...this.violations];
  }

  clear(): void {
    this.violations = [];
  }
}

export const violationLogger = new ViolationLogger();

export default {
  validatePortfolio,
  validatePortfolioItem,
  validatePrediction,
  isPortfolioValueValid,
  isSharesCountValid,
  isPriceValid,
  clampValue,
  sanitizeTicker,
  sanitizeText,
  sanitizeNumber,
  apiRateLimiter,
  voiceRateLimiter,
  withGuardrails,
  violationLogger,
};
