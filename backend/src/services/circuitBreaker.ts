/**
 * Roneira AI HIFI - Circuit Breaker Service
 *
 * Implements the circuit breaker pattern using opossum for external API calls.
 * When external services fail repeatedly, the circuit opens to prevent cascading
 * failures and serves cached/fallback data instead.
 *
 * @module services/circuitBreaker
 */

import CircuitBreaker from 'opossum';
import logger from '../utils/logger';

/**
 * Circuit breaker configuration options
 */
export interface CircuitBreakerOptions {
  /** Time in ms to wait before retrying after opening */
  resetTimeout?: number;
  /** Number of failures before opening the circuit */
  errorThresholdPercentage?: number;
  /** Time in ms before a request times out */
  timeout?: number;
  /** Rolling window size for calculating error percentage */
  rollingCountTimeout?: number;
  /** Number of buckets in the rolling window */
  rollingCountBuckets?: number;
  /** Name for logging purposes */
  name?: string;
}

/**
 * Default circuit breaker options optimized for financial APIs
 */
const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  timeout: 10000, // 10 seconds (financial APIs can be slow)
  errorThresholdPercentage: 50, // Open if 50% of requests fail
  resetTimeout: 30000, // Try again after 30 seconds
  rollingCountTimeout: 60000, // 1 minute rolling window
  rollingCountBuckets: 6, // 10-second buckets
};

/**
 * Circuit breaker state change handler
 */
function createStateChangeHandlers<T>(name: string, fallbackFn?: () => T) {
  return {
    onOpen: (): void => {
      logger.warn(`Circuit breaker "${name}" OPENED - Service is failing, using fallback`);
    },
    onClose: (): void => {
      logger.info(`Circuit breaker "${name}" CLOSED - Service recovered`);
    },
    onHalfOpen: (): void => {
      logger.info(`Circuit breaker "${name}" HALF-OPEN - Testing service availability`);
    },
    onFallback: (result: T): void => {
      logger.debug(`Circuit breaker "${name}" using fallback response`);
    },
    onTimeout: (): void => {
      logger.warn(`Circuit breaker "${name}" request timed out`);
    },
    onReject: (): void => {
      logger.debug(`Circuit breaker "${name}" rejected request - circuit is open`);
    },
    onSuccess: (): void => {
      logger.debug(`Circuit breaker "${name}" request succeeded`);
    },
    onFailure: (error: Error): void => {
      logger.error(`Circuit breaker "${name}" request failed:`, error.message);
    },
  };
}

/**
 * Create a circuit breaker wrapped function
 *
 * @param fn - Async function to wrap with circuit breaker
 * @param fallbackFn - Function to call when circuit is open
 * @param options - Circuit breaker configuration
 * @returns Circuit breaker instance
 *
 * @example
 * const fetchStockData = createCircuitBreaker(
 *   async (ticker: string) => alphaVantage.getQuote(ticker),
 *   async (ticker: string) => cache.get(`stock:${ticker}`),
 *   { name: 'AlphaVantage-Quote' }
 * );
 *
 * const data = await fetchStockData.fire('AAPL');
 */
export function createCircuitBreaker<TParams extends unknown[], TResult>(
  fn: (...args: TParams) => Promise<TResult>,
  fallbackFn?: (...args: TParams) => TResult | Promise<TResult>,
  options: CircuitBreakerOptions = {}
): CircuitBreaker<TParams, TResult> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const name = mergedOptions.name || 'unnamed-circuit';

  const breaker = new CircuitBreaker(fn, {
    timeout: mergedOptions.timeout,
    errorThresholdPercentage: mergedOptions.errorThresholdPercentage,
    resetTimeout: mergedOptions.resetTimeout,
    rollingCountTimeout: mergedOptions.rollingCountTimeout,
    rollingCountBuckets: mergedOptions.rollingCountBuckets,
  });

  // Set up fallback if provided
  if (fallbackFn) {
    breaker.fallback(fallbackFn);
  }

  // Set up event handlers
  const handlers = createStateChangeHandlers<TResult>(name, fallbackFn ? () => fallbackFn(...([] as unknown as TParams)) : undefined);
  breaker.on('open', handlers.onOpen);
  breaker.on('close', handlers.onClose);
  breaker.on('halfOpen', handlers.onHalfOpen);
  breaker.on('fallback', handlers.onFallback);
  breaker.on('timeout', handlers.onTimeout);
  breaker.on('reject', handlers.onReject);
  breaker.on('success', handlers.onSuccess);
  breaker.on('failure', handlers.onFailure);

  return breaker;
}

/**
 * Circuit breaker stats for monitoring
 */
export interface CircuitBreakerStats {
  state: 'OPEN' | 'CLOSED' | 'HALF_OPEN';
  failures: number;
  fallbacks: number;
  successes: number;
  rejects: number;
  timeouts: number;
  percentile95: number;
  percentile99: number;
}

/**
 * Get statistics from a circuit breaker
 */
export function getCircuitBreakerStats(breaker: CircuitBreaker<unknown[], unknown>): CircuitBreakerStats {
  const stats = breaker.stats;
  return {
    state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
    failures: stats.failures,
    fallbacks: stats.fallbacks,
    successes: stats.successes,
    rejects: stats.rejects,
    timeouts: stats.timeouts,
    percentile95: stats.latencyTimes.percentile(95),
    percentile99: stats.latencyTimes.percentile(99),
  };
}

// =====================================================
// PRE-CONFIGURED CIRCUIT BREAKERS FOR COMMON SERVICES
// =====================================================

/**
 * Alpha Vantage API circuit breaker options
 * Tuned for rate-limited financial API
 */
export const ALPHA_VANTAGE_CIRCUIT_OPTIONS: CircuitBreakerOptions = {
  name: 'AlphaVantage',
  timeout: 15000, // 15 seconds (API can be slow)
  errorThresholdPercentage: 40, // Open early due to rate limits
  resetTimeout: 60000, // 1 minute (respect rate limits)
  rollingCountTimeout: 120000, // 2 minute window
  rollingCountBuckets: 12,
};

/**
 * ML Service circuit breaker options
 * Tuned for internal ML predictions
 */
export const ML_SERVICE_CIRCUIT_OPTIONS: CircuitBreakerOptions = {
  name: 'MLService',
  timeout: 30000, // 30 seconds (ML can be compute-intensive)
  errorThresholdPercentage: 50,
  resetTimeout: 15000, // 15 seconds (internal service, recover faster)
  rollingCountTimeout: 60000,
  rollingCountBuckets: 6,
};

/**
 * News API circuit breaker options
 */
export const NEWS_API_CIRCUIT_OPTIONS: CircuitBreakerOptions = {
  name: 'NewsAPI',
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 60000,
  rollingCountBuckets: 6,
};

export default createCircuitBreaker;
