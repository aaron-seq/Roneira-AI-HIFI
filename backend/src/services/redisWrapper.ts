/**
 * Roneira AI HIFI - Redis Cache Wrapper Service
 *
 * Production-ready Redis wrapper with connection pooling, error handling,
 * and typed cache operations. Designed for hot data caching and session storage.
 *
 * @module services/redisWrapper
 */

import Redis, { RedisOptions } from 'ioredis';
import logger from '../utils/logger';

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number;
}

/**
 * Redis connection status
 */
interface RedisConnectionStatus {
  connected: boolean;
  ready: boolean;
  status: string;
  lastError?: string;
}

/**
 * Redis Cache Service
 *
 * Provides a type-safe wrapper around Redis with automatic serialization,
 * connection management, and error handling.
 */
class RedisCacheService {
  private client: Redis | null = null;
  private connectionStatus: RedisConnectionStatus = {
    connected: false,
    ready: false,
    status: 'disconnected',
  };

  /**
   * Default TTL in seconds (5 minutes)
   */
  private defaultTTL = 300;

  /**
   * Key prefix for namespacing
   */
  private keyPrefix = 'roneira:';

  /**
   * Initialize Redis connection
   *
   * @param redisUrl - Redis connection URL
   * @param options - Additional Redis options
   */
  async connect(redisUrl?: string, options: Partial<RedisOptions> = {}): Promise<void> {
    if (this.client && this.connectionStatus.ready) {
      logger.debug('Redis client already connected');
      return;
    }

    const connectionOptions: RedisOptions = {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      ...options,
    };

    try {
      if (redisUrl) {
        this.client = new Redis(redisUrl, connectionOptions);
      } else {
        this.client = new Redis(connectionOptions);
      }

      // Set up event handlers
      this.setupEventHandlers();

      // Connect
      await this.client.connect();

      logger.info('Redis cache service connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.client = null;
      throw error;
    }
  }

  /**
   * Set up Redis event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.connectionStatus.connected = true;
      this.connectionStatus.status = 'connecting';
      logger.debug('Redis connecting...');
    });

    this.client.on('ready', () => {
      this.connectionStatus.ready = true;
      this.connectionStatus.status = 'ready';
      logger.info('Redis connection ready');
    });

    this.client.on('error', (error: Error) => {
      this.connectionStatus.lastError = error.message;
      logger.error('Redis error:', error.message);
    });

    this.client.on('close', () => {
      this.connectionStatus.connected = false;
      this.connectionStatus.ready = false;
      this.connectionStatus.status = 'closed';
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      this.connectionStatus.status = 'reconnecting';
      logger.info('Redis reconnecting...');
    });
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connectionStatus = {
        connected: false,
        ready: false,
        status: 'disconnected',
      };
      logger.info('Redis cache service disconnected');
    }
  }

  /**
   * Get connection status
   */
  getStatus(): RedisConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.client !== null && this.connectionStatus.ready;
  }

  /**
   * Build full key with prefix
   */
  private buildKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Get a value from cache
   *
   * @param key - Cache key
   * @returns Cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      logger.debug('Redis not available, cache miss for:', key);
      return null;
    }

    try {
      const fullKey = this.buildKey(key);
      const value = await this.client!.get(fullKey);

      if (!value) {
        return null;
      }

      const entry = JSON.parse(value) as CacheEntry<T>;
      return entry.data;
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Set a value in cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds (default: 5 minutes)
   */
  async set<T>(key: string, value: T, ttlSeconds: number = this.defaultTTL): Promise<boolean> {
    if (!this.isAvailable()) {
      logger.debug('Redis not available, skipping cache set for:', key);
      return false;
    }

    try {
      const fullKey = this.buildKey(key);
      const entry: CacheEntry<T> = {
        data: value,
        cachedAt: Date.now(),
        ttl: ttlSeconds,
      };

      await this.client!.setex(fullKey, ttlSeconds, JSON.stringify(entry));
      return true;
    } catch (error) {
      logger.error('Redis set error:', error);
      return false;
    }
  }

  /**
   * Delete a value from cache
   *
   * @param key - Cache key
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key);
      const result = await this.client!.del(fullKey);
      return result > 0;
    } catch (error) {
      logger.error('Redis delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   *
   * @param pattern - Key pattern (e.g., 'stock:*')
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const fullPattern = this.buildKey(pattern);
      const keys = await this.client!.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client!.del(...keys);
      return result;
    } catch (error) {
      logger.error('Redis deletePattern error:', error);
      return 0;
    }
  }

  /**
   * Get or set cached value (cache-aside pattern)
   *
   * @param key - Cache key
   * @param fetchFn - Function to fetch value if not cached
   * @param ttlSeconds - Time to live in seconds
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = this.defaultTTL
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      logger.debug('Cache hit for:', key);
      return cached;
    }

    // Fetch fresh data
    logger.debug('Cache miss for:', key);
    const value = await fetchFn();

    // Store in cache (fire and forget)
    this.set(key, value, ttlSeconds).catch((error) => {
      logger.error('Failed to cache value:', error);
    });

    return value;
  }

  /**
   * Check if a key exists
   *
   * @param key - Cache key
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key);
      const result = await this.client!.exists(fullKey);
      return result > 0;
    } catch (error) {
      logger.error('Redis exists error:', error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   *
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async getTTL(key: string): Promise<number> {
    if (!this.isAvailable()) {
      return -2;
    }

    try {
      const fullKey = this.buildKey(key);
      return await this.client!.ttl(fullKey);
    } catch (error) {
      logger.error('Redis TTL error:', error);
      return -2;
    }
  }

  /**
   * Increment a numeric value
   *
   * @param key - Cache key
   * @param amount - Amount to increment (default: 1)
   */
  async increment(key: string, amount: number = 1): Promise<number | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const fullKey = this.buildKey(key);
      return await this.client!.incrby(fullKey, amount);
    } catch (error) {
      logger.error('Redis increment error:', error);
      return null;
    }
  }

  /**
   * Health check ping
   */
  async ping(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }
}

// =====================================================
// CACHE KEY GENERATORS
// =====================================================

/**
 * Generate cache key for stock quotes
 */
export function stockQuoteKey(ticker: string): string {
  return `stock:quote:${ticker.toUpperCase()}`;
}

/**
 * Generate cache key for stock predictions
 */
export function predictionKey(ticker: string, days: number): string {
  return `prediction:${ticker.toUpperCase()}:${days}d`;
}

/**
 * Generate cache key for portfolio data
 */
export function portfolioKey(userId: string = 'default'): string {
  return `portfolio:${userId}`;
}

/**
 * Generate cache key for PDM signals
 */
export function pdmSignalKey(ticker: string): string {
  return `pdm:signal:${ticker.toUpperCase()}`;
}

/**
 * Generate cache key for news
 */
export function newsKey(ticker?: string): string {
  return ticker ? `news:${ticker.toUpperCase()}` : 'news:market';
}

// Export singleton instance
export const redisCache = new RedisCacheService();
export default redisCache;
