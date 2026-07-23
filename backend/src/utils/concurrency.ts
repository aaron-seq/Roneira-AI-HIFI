/**
 * Bounded-concurrency mapper - runs `worker` over `items` with at most
 * `limit` in flight at once, preserving input order in the result array.
 * Avoids pulling in an external queue dependency for small, fixed-size
 * request batches (e.g. fetching a handful of market quotes).
 */
export async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
}
