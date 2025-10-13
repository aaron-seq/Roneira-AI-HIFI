import NodeCache from 'node-cache';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

/**
 * In-memory caching service using node-cache
 * Provides intelligent caching for API responses to improve performance
 */
export class CacheService {
  constructor() {
    this.defaultTtl = config.cache.defaultTtlSeconds;
    this.predictionTtl = config.cache.predictionTtlSeconds;
    this.stockDataTtl = config.cache.stockDataTtlSeconds;
    
    // Initialize cache with configuration
    this.cache = new NodeCache({
      stdTTL: this.defaultTtl,
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false, // Don't clone objects for better performance
      deleteOnExpire: true,
      enableLegacyCallbacks: false
    });

    // Set up cache event listeners
    this.setupEventListeners();
    
    logger.info('Cache service initialized', {
      defaultTtl: this.defaultTtl,
      predictionTtl: this.predictionTtl,
      stockDataTtl: this.stockDataTtl
    });
  }

  /**
   * Set up event listeners for cache monitoring
   */
  setupEventListeners() {
    this.cache.on('set', (key, value) => {
      logger.debug(`Cache SET: ${key}`);
    });

    this.cache.on('get', (key, value) => {
      logger.debug(`Cache HIT: ${key}`);
    });

    this.cache.on('expired', (key, value) => {
      logger.debug(`Cache EXPIRED: ${key}`);
    });

    this.cache.on('flush', () => {
      logger.info('Cache flushed');
    });
  }

  /**
   * Store a value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttlSeconds - Time to live in seconds (optional)
   * @returns {boolean} Success status
   */
  set(key, value, ttlSeconds = null) {
    try {
      const ttl = ttlSeconds || this.getDefaultTtlForKey(key);
      const success = this.cache.set(key, value, ttl);
      
      if (success) {
        logger.debug(`Cached data for key: ${key} (TTL: ${ttl}s)`);
      } else {
        logger.warn(`Failed to cache data for key: ${key}`);
      }
      
      return success;
    } catch (error) {
      logger.error(`Error setting cache for key: ${key}`, error);
      return false;
    }
  }

  /**
   * Retrieve a value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined if not found
   */
  get(key) {
    try {
      const value = this.cache.get(key);
      
      if (value !== undefined) {
        logger.debug(`Cache hit for key: ${key}`);
      } else {
        logger.debug(`Cache miss for key: ${key}`);
      }
      
      return value;
    } catch (error) {
      logger.error(`Error getting cache for key: ${key}`, error);
      return undefined;
    }
  }

  /**
   * Check if a key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} Whether the key exists
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Delete a specific key from cache
   * @param {string} key - Cache key to delete
   * @returns {number} Number of deleted entries
   */
  delete(key) {
    try {
      const deletedCount = this.cache.del(key);
      logger.debug(`Deleted cache key: ${key}`);
      return deletedCount;
    } catch (error) {
      logger.error(`Error deleting cache key: ${key}`, error);
      return 0;
    }
  }

  /**
   * Delete multiple keys from cache
   * @param {string[]} keys - Array of cache keys to delete
   * @returns {number} Number of deleted entries
   */
  deleteMultiple(keys) {
    try {
      const deletedCount = this.cache.del(keys);
      logger.debug(`Deleted cache keys: ${keys.join(', ')}`);
      return deletedCount;
    } catch (error) {
      logger.error(`Error deleting cache keys: ${keys.join(', ')}`, error);
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  flush() {
    try {
      this.cache.flushAll();
      logger.info('Cache flushed successfully');
    } catch (error) {
      logger.error('Error flushing cache', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getStats() {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      ksize: stats.ksize,
      vsize: stats.vsize,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0
    };
  }

  /**
   * Get all cache keys
   * @returns {string[]} Array of cache keys
   */
  getKeys() {
    return this.cache.keys();
  }

  /**
   * Get TTL for a specific key
   * @param {string} key - Cache key
   * @returns {number} TTL in seconds, or undefined if key doesn't exist
   */
  getTtl(key) {
    return this.cache.getTtl(key);
  }

  /**
   * Set TTL for an existing key
   * @param {string} key - Cache key
   * @param {number} ttlSeconds - New TTL in seconds
   * @returns {boolean} Success status
   */
  setTtl(key, ttlSeconds) {
    return this.cache.ttl(key, ttlSeconds);
  }

  /**
   * Get default TTL based on key pattern
   * @param {string} key - Cache key
   * @returns {number} TTL in seconds
   */
  getDefaultTtlForKey(key) {
    if (key.startsWith('prediction:')) {
      return this.predictionTtl;
    }
    
    if (key.startsWith('stock:')) {
      return this.stockDataTtl;
    }
    
    return this.defaultTtl;
  }

  /**
   * Cache a stock prediction with appropriate TTL
   * @param {string} ticker - Stock ticker
   * @param {number} days - Prediction days
   * @param {object} prediction - Prediction data
   * @returns {boolean} Success status
   */
  cachePrediction(ticker, days, prediction) {
    const key = `prediction:${ticker}:${days}`;
    return this.set(key, prediction, this.predictionTtl);
  }

  /**
   * Get cached stock prediction
   * @param {string} ticker - Stock ticker
   * @param {number} days - Prediction days
   * @returns {object|undefined} Cached prediction or undefined
   */
  getCachedPrediction(ticker, days) {
    const key = `prediction:${ticker}:${days}`;
    return this.get(key);
  }

  /**
   * Invalidate all predictions for a specific ticker
   * @param {string} ticker - Stock ticker
   * @returns {number} Number of deleted entries
   */
  invalidateTickerPredictions(ticker) {
    const keys = this.getKeys();
    const tickerKeys = keys.filter(key => 
      key.startsWith(`prediction:${ticker}:`)
    );
    
    if (tickerKeys.length > 0) {
      return this.deleteMultiple(tickerKeys);
    }
    
    return 0;
  }
}