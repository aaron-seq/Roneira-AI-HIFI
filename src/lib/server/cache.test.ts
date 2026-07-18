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
    it("clears all cached values when no key is provided", async () => {
      let calls1 = 0;
      let calls2 = 0;
      await getCachedValue("key1", 1_000, async () => { calls1++; return "val1"; });
      await getCachedValue("key2", 1_000, async () => { calls2++; return "val2"; });

      clearCachedValue();

      await getCachedValue("key1", 1_000, async () => { calls1++; return "val1"; });
      await getCachedValue("key2", 1_000, async () => { calls2++; return "val2"; });

      expect(calls1).toBe(2);
      expect(calls2).toBe(2);
    });

    it("clears only the specific key when a key is provided", async () => {
      let calls1 = 0;
      let calls2 = 0;
      await getCachedValue("key1", 1_000, async () => { calls1++; return "val1"; });
      await getCachedValue("key2", 1_000, async () => { calls2++; return "val2"; });

      clearCachedValue("key1");

      await getCachedValue("key1", 1_000, async () => { calls1++; return "val1"; });
      await getCachedValue("key2", 1_000, async () => { calls2++; return "val2"; });

      expect(calls1).toBe(2);
      expect(calls2).toBe(1); // Not called again, used cache
    });
  });
});
