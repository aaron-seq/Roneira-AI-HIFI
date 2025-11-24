/**
 * Redis Cache Service with TypeScript
 * Provides caching functionality with TTL support
 */

interface CacheData {
    [key: string]: {
        value: any;
        expiry: number;
    };
}

// In-memory cache fallback (used when Redis is not available)
const memoryCache: CacheData = {};

/**
 * Get cached data by key
 * @param key Cache key
 * @returns Cached value or null if not found/expired
 */
export async function getCachedData(key: string): Promise<any | null> {
    try {
        // Check in-memory cache
        const cached = memoryCache[key];

        if (!cached) {
            return null;
        }

        // Check if expired
        if (Date.now() > cached.expiry) {
            delete memoryCache[key];
            return null;
        }

        return cached.value;
    } catch (error) {
        console.error(`Cache get error for key ${key}:`, error);
        return null;
    }
}

/**
 * Set cached data with TTL
 * @param key Cache key
 * @param value Value to cache
 * @param ttl Time to live in seconds
 */
export async function setCachedData(key: string, value: any, ttl: number): Promise<void> {
    try {
        memoryCache[key] = {
            value,
            expiry: Date.now() + (ttl * 1000)
        };

        console.log(`Cached key: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
        console.error(`Cache set error for key ${key}:`, error);
    }
}

/**
 * Delete cached data by key
 * @param key Cache key
 */
export async function deleteCachedData(key: string): Promise<void> {
    try {
        delete memoryCache[key];
        console.log(`Deleted cache key: ${key}`);
    } catch (error) {
        console.error(`Cache delete error for key ${key}:`, error);
    }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
    try {
        Object.keys(memoryCache).forEach(key => {
            delete memoryCache[key];
        });
        console.log('Cache cleared');
    } catch (error) {
        console.error('Cache clear error:', error);
    }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { keys: number; items: string[] } {
    const keys = Object.keys(memoryCache);
    return {
        keys: keys.length,
        items: keys
    };
}
