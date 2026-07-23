/**
 * Cache Service with TTL, stale-while-revalidate, and prefix invalidation.
 * In-memory implementation (used as the fallback when Redis is not wired up).
 */

interface CacheEntry {
  value: unknown;
  cachedAt: number;
  expiry: number;
}

const memoryCache: Map<string, CacheEntry> = new Map();

/**
 * Get cached data by key
 * @param key Cache key
 * @returns Cached value or null if not found/expired
 */
export async function getCachedData(key: string): Promise<unknown | null> {
  try {
    const cached = memoryCache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiry) {
      memoryCache.delete(key);
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
export async function setCachedData(key: string, value: unknown, ttl: number): Promise<void> {
  try {
    memoryCache.set(key, {
      value,
      cachedAt: Date.now(),
      expiry: Date.now() + ttl * 1000,
    });
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error);
  }
}

/**
 * Delete cached data by key
 */
export async function deleteCachedData(key: string): Promise<void> {
  memoryCache.delete(key);
}

/**
 * Delete every cached entry whose key starts with `prefix`.
 * Used for manual/administrative cache invalidation (e.g. per-ticker).
 * @returns number of entries removed
 */
export async function invalidateByPrefix(prefix: string): Promise<number> {
  let removed = 0;
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
      removed++;
    }
  }
  return removed;
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
  memoryCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { keys: number; items: string[] } {
  const keys = Array.from(memoryCache.keys());
  return {
    keys: keys.length,
    items: keys,
  };
}

export interface StaleWhileRevalidateOptions {
  /** Total time a cached value stays usable, in seconds. */
  ttlSeconds: number;
  /**
   * How many seconds before expiry a background refresh is kicked off while
   * still serving the (stale-but-valid) cached value. Defaults to 20% of ttl.
   */
  refreshBeforeSeconds?: number;
}

export interface StaleWhileRevalidateResult<T> {
  value: T;
  cached: boolean;
  stale: boolean;
}

// Tracks in-flight background refreshes so concurrent requests for the same
// key don't trigger duplicate upstream calls.
const refreshInFlight = new Set<string>();

/**
 * Stale-while-revalidate cache read-through helper.
 *
 * - Fresh cache hit (age < ttl - refreshBefore): return immediately.
 * - Stale-but-valid cache hit (age >= ttl - refreshBefore but < ttl): return
 *   the cached value immediately and refresh in the background.
 * - Miss or fully expired: await `fetcher`, cache the result, and return it.
 */
export async function getWithStaleWhileRevalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: StaleWhileRevalidateOptions
): Promise<StaleWhileRevalidateResult<T>> {
  const ttlMs = options.ttlSeconds * 1000;
  const refreshBeforeMs = (options.refreshBeforeSeconds ?? options.ttlSeconds * 0.2) * 1000;

  const cached = memoryCache.get(key);

  if (cached && Date.now() <= cached.expiry) {
    const age = Date.now() - cached.cachedAt;
    const isStale = age >= ttlMs - refreshBeforeMs;

    if (isStale && !refreshInFlight.has(key)) {
      refreshInFlight.add(key);
      fetcher()
        .then((freshValue) => setCachedData(key, freshValue, options.ttlSeconds))
        .catch(() => {
          /* keep serving stale data; next request will retry */
        })
        .finally(() => refreshInFlight.delete(key));
    }

    return { value: cached.value as T, cached: true, stale: isStale };
  }

  const freshValue = await fetcher();
  await setCachedData(key, freshValue, options.ttlSeconds);
  return { value: freshValue, cached: false, stale: false };
}
