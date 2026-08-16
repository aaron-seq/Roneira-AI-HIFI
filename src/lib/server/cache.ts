type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

declare global {
  // eslint-disable-next-line no-var
  var __roneiraServerCache: Map<string, CacheEntry<unknown>> | undefined;
}

const cacheStore = globalThis.__roneiraServerCache ?? new Map<string, CacheEntry<unknown>>();

if (!globalThis.__roneiraServerCache) {
  globalThis.__roneiraServerCache = cacheStore;
}

/**
 * Loads in progress, keyed identically to `cacheStore`.
 *
 * Without this, N concurrent misses on the same cold key each call `loader()`.
 * That matters here specifically because the loaders sit in front of metered
 * free tiers (Alpha Vantage allows 25 requests/day), so a burst at a TTL
 * boundary could spend a large fraction of the daily quota fetching one value.
 */
const inFlight = new Map<string, Promise<unknown>>();

export async function getCachedValue<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = cacheStore.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  // Join an in-progress load rather than starting a second one.
  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  // Expired entries are only ever overwritten, never removed, so a key that
  // stops being requested would otherwise hold its value for the life of the
  // process. `search:` keys are built from user input (see market.ts), so that
  // key space is externally controlled and unbounded.
  for (const [entryKey, entry] of cacheStore) {
    if (entry.expiresAt <= now) {
      cacheStore.delete(entryKey);
    }
  }

  const load = (async () => {
    try {
      const value = await loader();
      cacheStore.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } finally {
      // Always clear, including on rejection -- otherwise one failed load
      // would permanently poison the key for every later caller.
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, load);
  return load;
}

/**
 * Number of retained entries.
 *
 * Exported because the bug this store had was unbounded *growth*, and growth is
 * not observable through `getCachedValue` alone -- an expired entry reloads
 * identically whether it was swept or merely overwritten. Tests assert on this
 * directly; it is also the number worth logging if the cache is ever suspected.
 */
export function cacheSize(): number {
  return cacheStore.size;
}

export function clearCachedValue(key?: string) {
  if (key) {
    cacheStore.delete(key);
    // Drop the in-flight load too, so a caller arriving after the clear starts
    // a fresh load rather than joining one whose result predates it.
    inFlight.delete(key);
    return;
  }

  cacheStore.clear();
  inFlight.clear();
}
