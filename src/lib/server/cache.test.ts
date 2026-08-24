import { getCachedValue, clearCachedValue, cacheSize } from "@/lib/server/cache";

describe("server cache", () => {
  afterEach(() => {
    clearCachedValue();
    vi.useRealTimers();
  });

  it("returns cached values inside the ttl window", async () => {
    let calls = 0;
    const first = await getCachedValue("quote:test", 1_000, async () => {
      calls += 1;
      return { value: 1 };
    });
    const second = await getCachedValue("quote:test", 1_000, async () => {
      calls += 1;
      return { value: 2 };
    });

    expect(first).toEqual({ value: 1 });
    expect(second).toEqual({ value: 1 });
    expect(calls).toBe(1);
  });

  it("reloads values after the ttl expires", async () => {
    vi.useFakeTimers();
    let calls = 0;

    await getCachedValue("quote:test", 1_000, async () => {
      calls += 1;
      return calls;
    });

    vi.advanceTimersByTime(1_001);

    const refreshed = await getCachedValue("quote:test", 1_000, async () => {
      calls += 1;
      return calls;
    });

    expect(refreshed).toBe(2);
    expect(calls).toBe(2);
  });

  it("runs the loader once for concurrent misses on the same key", async () => {
    // The loaders sit in front of metered free tiers (Alpha Vantage: 25/day),
    // so N concurrent cold misses must not become N upstream calls.
    let calls = 0;
    let release!: (value: number) => void;
    const gate = new Promise<number>((resolve) => {
      release = resolve;
    });

    const loader = async () => {
      calls += 1;
      return gate;
    };

    const all = Promise.all([
      getCachedValue("quote:concurrent", 1_000, loader),
      getCachedValue("quote:concurrent", 1_000, loader),
      getCachedValue("quote:concurrent", 1_000, loader),
    ]);

    release(7);

    expect(await all).toEqual([7, 7, 7]);
    expect(calls).toBe(1);
  });

  it("does not cache a rejected load, and lets the next caller retry", async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("upstream down");
      }
      return "recovered";
    };

    await expect(
      getCachedValue("quote:fails", 1_000, loader)
    ).rejects.toThrow("upstream down");

    // A failed load must not poison the key for everyone after it.
    await expect(getCachedValue("quote:fails", 1_000, loader)).resolves.toBe(
      "recovered"
    );
    expect(calls).toBe(2);
  });

  it("evicts expired entries instead of retaining them for the process lifetime", async () => {
    vi.useFakeTimers();

    // `search:` keys are built from user input, so this key space is
    // externally controlled -- retention here is unbounded growth.
    await getCachedValue("search:aaa", 1_000, async () => "a");
    await getCachedValue("search:bbb", 1_000, async () => "b");
    expect(cacheSize()).toBe(2);

    vi.advanceTimersByTime(1_001);

    // Touching any key sweeps the expired ones, so the two dead entries go
    // away rather than being retained until the process restarts.
    await getCachedValue("search:ccc", 1_000, async () => "c");

    expect(cacheSize()).toBe(1);
  });
});
