import { rateLimit, clientIp, rateLimitStoreSize } from "@/lib/server/rate-limit";

function req(ip: string): Request {
  return new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("clientIp", () => {
  it("takes the first entry of x-forwarded-for", () => {
    expect(clientIp(req("203.0.113.5, 10.0.0.1"))).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip, then unknown", () => {
    expect(
      clientIp(
        new Request("http://localhost/", { headers: { "x-real-ip": "198.51.100.7" } })
      )
    ).toBe("198.51.100.7");
    expect(clientIp(new Request("http://localhost/"))).toBe("unknown");
  });
});

describe("rateLimit (in-process fallback)", () => {
  // No UPSTASH_* env in test, so this exercises the local window.
  it("allows up to the limit then blocks", async () => {
    const ip = `192.0.2.${Math.floor(Math.random() * 250) + 1}`;
    const bucket = `test-${Date.now()}-${Math.random()}`;

    const first = await rateLimit(bucket, req(ip), 3, 60);
    expect(first.ok).toBe(true);
    expect(first.local).toBe(true);
    expect(first.remaining).toBe(2);

    expect((await rateLimit(bucket, req(ip), 3, 60)).ok).toBe(true);
    expect((await rateLimit(bucket, req(ip), 3, 60)).ok).toBe(true);

    // Fourth hit in the same window exceeds the limit of 3.
    const blocked = await rateLimit(bucket, req(ip), 3, 60);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks callers independently", async () => {
    const bucket = `test-iso-${Date.now()}-${Math.random()}`;
    await rateLimit(bucket, req("198.51.100.1"), 1, 60);

    const blockedForFirst = await rateLimit(bucket, req("198.51.100.1"), 1, 60);
    expect(blockedForFirst.ok).toBe(false);

    // A different IP starts with a fresh allowance.
    const other = await rateLimit(bucket, req("198.51.100.2"), 1, 60);
    expect(other.ok).toBe(true);
  });

  it("evicts windows that have passed rather than retaining them forever", async () => {
    vi.useFakeTimers();
    try {
      const bucket = `test-evict-${Math.random()}`;
      const before = rateLimitStoreSize();

      // Three different callers, all inside the same 60s window.
      await rateLimit(bucket, req("203.0.113.10"), 5, 60);
      await rateLimit(bucket, req("203.0.113.11"), 5, 60);
      await rateLimit(bucket, req("203.0.113.12"), 5, 60);
      expect(rateLimitStoreSize()).toBe(before + 3);

      // Advance past the window. The key embeds the window index, so those
      // three keys are now unreachable -- nothing would ever look them up
      // again, so without an explicit sweep they would be retained for the
      // life of the process, one per caller per window, forever.
      vi.advanceTimersByTime(61_000);

      await rateLimit(bucket, req("203.0.113.10"), 5, 60);

      // The three dead windows are gone; only the new one remains.
      expect(rateLimitStoreSize()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
