import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), getNormalizedQuotes: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/server/market", () => ({ getNormalizedQuotes: mocks.getNormalizedQuotes }));

import { GET } from "./route";

const row = {
  id: "a1", user_id: "u1", ticker: "TCS.NS", exchange: "NSE", alert_price: 3500,
  alert_revision: 7, alert_armed_at: "2026-10-08T10:00:00Z",
  users: { preferences: { notifications: { priceAlerts: true } } },
};
const request = () => new Request("https://example.test/api/cron/alerts?market=india", {
  headers: { authorization: "Bearer test-cron-secret" },
});

describe("price alert cron delivery", () => {
  let rpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T11:00:00Z"));
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    const query = {
      select: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ data: [row], error: null }),
    };
    rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query), rpc });
    mocks.getNormalizedQuotes.mockResolvedValue([{
      symbol: "TCS.NS", price: 3450, high: 3520, low: 3440,
      timestamp: null, sessionDate: "2026-10-09", sessionTimezone: "Asia/Kolkata",
    }]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("rejects unauthenticated calls before opening an admin client", async () => {
    const response = await GET(new Request("https://example.test/api/cron/alerts?market=india"));
    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("uses one atomic RPC with the evaluated price, revision, and trading date", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("deliver_price_alert", {
      p_watchlist_id: "a1", p_expected_price: 3500, p_expected_revision: 7, p_session_date: "2026-10-09",
    });
    expect(await response.json()).toMatchObject({ fired: 1, failed: 0 });
  });

  it("reports a failed transaction as retryable and retries the same armed alert", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "notification insert failed" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const failed = await GET(request());
      expect(failed.status).toBe(503);
      expect(await failed.json()).toMatchObject({ fired: 0, failed: 1 });
      const retry = await GET(request());
      expect(retry.status).toBe(200);
      expect(await retry.json()).toMatchObject({ fired: 1, failed: 0 });
      expect(rpc).toHaveBeenCalledTimes(2);
    } finally {
      log.mockRestore();
    }
  });

  it("does not count an overlapping run or changed snapshot as a delivery", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await (await GET(request())).json()).toMatchObject({ fired: 0, failed: 0 });
  });

  it("does not claim an alert using a prior session's high-low range", async () => {
    mocks.getNormalizedQuotes.mockResolvedValue([{
      symbol: "TCS.NS", price: 3450, high: 3520, low: 3440,
      timestamp: null, sessionDate: "2026-10-08", sessionTimezone: "Asia/Kolkata",
    }]);
    expect(await (await GET(request())).json()).toMatchObject({ fired: 0, failed: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
