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
});
