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

  const value = await loader();
  cacheStore.set(key, {
    value,
    expiresAt: now + ttlMs,
  });
  return value;
}

export function clearCachedValue(key?: string) {
  if (key) {
    cacheStore.delete(key);
    return;
  }

  cacheStore.clear();
}
