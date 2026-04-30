import { getCachedValue, clearCachedValue } from "@/lib/server/cache";

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

  describe("clearCachedValue", () => {
    it("clears specific key from cache", async () => {
      let calls1 = 0;
      let calls2 = 0;

      await getCachedValue("key1", 10_000, async () => {
        calls1 += 1;
        return { val: "1" };
      });

      await getCachedValue("key2", 10_000, async () => {
        calls2 += 1;
        return { val: "2" };
      });

      clearCachedValue("key1");

      const key1Refetched = await getCachedValue("key1", 10_000, async () => {
        calls1 += 1;
        return { val: "1_refetched" };
      });

      const key2Refetched = await getCachedValue("key2", 10_000, async () => {
        calls2 += 1;
        return { val: "2_refetched" };
      });

      expect(key1Refetched).toEqual({ val: "1_refetched" });
      expect(calls1).toBe(2); // refetched

      expect(key2Refetched).toEqual({ val: "2" });
      expect(calls2).toBe(1); // returned cached
    });

    it("flushes entire cache when no key is specified", async () => {
      let calls1 = 0;
      let calls2 = 0;

      await getCachedValue("keyA", 10_000, async () => {
        calls1 += 1;
        return { val: "A" };
      });

      await getCachedValue("keyB", 10_000, async () => {
        calls2 += 1;
        return { val: "B" };
      });

      clearCachedValue();

      const keyARefetched = await getCachedValue("keyA", 10_000, async () => {
        calls1 += 1;
        return { val: "A_refetched" };
      });

      const keyBRefetched = await getCachedValue("keyB", 10_000, async () => {
        calls2 += 1;
        return { val: "B_refetched" };
      });

      expect(keyARefetched).toEqual({ val: "A_refetched" });
      expect(calls1).toBe(2); // refetched

      expect(keyBRefetched).toEqual({ val: "B_refetched" });
      expect(calls2).toBe(2); // refetched
    });
  });
});
