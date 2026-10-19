import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(), getUser: vi.fn(), getNormalizedQuotes: vi.fn(), rateLimit: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/server/market", () => ({ getNormalizedQuotes: mocks.getNormalizedQuotes }));
vi.mock("@/lib/server/rate-limit", () => ({ rateLimit: mocks.rateLimit, tooManyRequests: () => Response.json({ error: "Too many requests" }, { status: 429 }) }));

import { GET, POST } from "./route";

const holding = {
  id: "h1", ticker: "TCS.NS", exchange: "NSE", quantity: 10, avg_buy_price: 100,
  sector: "Technology", updated_at: "2026-10-18T10:00:00Z",
};
const quote = {
  symbol: "TCS.NS", name: "TCS", exchange: "NSE", assetType: "equity", currency: "INR",
  price: 120, change: 0, changePercent: 0, provider: "yfinance", timestamp: null, sessionDate: "2026-10-16", sessionTimezone: "Asia/Kolkata",
};
const stored = {
  id: "s1", user_id: "owner", valuation_date: "2026-10-19", captured_at: "2026-10-19T00:30:00.000Z", holdings_observed_at: "2026-10-19T00:30:00.000Z", currency: "INR",
  invested_value: 1000, current_value: 1200, pnl: 200, pnl_percent: 20, total_holdings: 1, priced_holdings: 1, coverage_complete: true,
  usd_inr: null, exclusions: [], quote_sources: [],
};
const getRequest = (query = "") => new Request(`https://example.test/api/portfolio/history${query}`);
const postRequest = (body: unknown = { currency: "INR" }) => new Request("https://example.test/api/portfolio/history", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});

describe("server-calculated portfolio history", () => {
  let sessionQuery: Record<string, ReturnType<typeof vi.fn>>;
  let sessionFrom: ReturnType<typeof vi.fn>;
  let holdingsResults: Array<{ data: typeof holding[] | null; error: unknown }>;
  let historyResult: { data: typeof stored[] | null; error: unknown };
  let saveResult: { data: typeof stored | null; error: unknown };
  let saveRpc: ReturnType<typeof vi.fn>;
  let adminFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T00:30:00Z"));
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
    mocks.rateLimit.mockResolvedValue({ ok: true });
    mocks.getNormalizedQuotes.mockResolvedValue([quote]);
    holdingsResults = [{ data: [holding], error: null }, { data: [holding], error: null }];
    historyResult = { data: [stored], error: null };
    saveResult = { data: stored, error: null };
    sessionQuery = Object.fromEntries(["select", "eq", "gte", "lte", "order"].map((key) => [key, vi.fn().mockImplementation(() => sessionQuery)]));
    sessionQuery.limit = vi.fn();
    sessionFrom = vi.fn().mockImplementation((table) => {
      sessionQuery.limit.mockImplementation(() => Promise.resolve(table === "portfolio_holdings" ? holdingsResults.shift() : historyResult));
      return sessionQuery;
    });
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: sessionFrom });
    saveRpc = vi.fn().mockImplementation(() => ({ single: () => Promise.resolve(saveResult) }));
    adminFrom = vi.fn();
    mocks.createAdminClient.mockReturnValue({ from: adminFrom, rpc: saveRpc });
  });

  afterEach(() => vi.useRealTimers());

  it.each([GET, POST])("rejects anonymous callers before holdings, prices or service-role access", async (handler) => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await handler(postRequest());
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(sessionFrom).not.toHaveBeenCalled();
    expect(mocks.getNormalizedQuotes).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("fails closed when session validation returns both a user and an error", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: new Error("expired") });
    expect((await POST(postRequest())).status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("reads only the verified owner's currency and bounded UTC dates through the session client", async () => {
    const response = await GET(getRequest("?currency=USD&days=3"));
    expect(response.status).toBe(200);
    expect(sessionFrom).toHaveBeenCalledWith("portfolio_valuation_snapshots");
    expect(sessionQuery.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(sessionQuery.eq).toHaveBeenCalledWith("currency", "USD");
    expect(sessionQuery.gte).toHaveBeenCalledWith("valuation_date", "2026-10-17");
    expect(sessionQuery.lte).toHaveBeenCalledWith("valuation_date", "2026-10-19");
    expect(sessionQuery.limit).toHaveBeenCalledWith(3);
    expect(await response.json()).toMatchObject({ currency: "USD", days: 3, snapshots: [{ valuedOn: "2026-10-19", currentValue: 1200 }] });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns an empty history without inventing earlier values", async () => {
    historyResult = { data: [], error: null };
    expect(await (await GET(getRequest())).json()).toMatchObject({ snapshots: [], days: 90, currency: "INR" });
  });

  it.each(["?days=0", "?days=366", "?days=1.5", "?days=Infinity", "?currency=EUR", "?user_id=someone-else", "?currency=INR&currency=USD"])("rejects invalid or ownership-changing read parameters %s", async (query) => {
    expect((await GET(getRequest(query))).status).toBe(400);
    expect(sessionFrom).not.toHaveBeenCalled();
  });

  it.each([
    { currency: "INR", user_id: "victim" }, { currency: "INR", currentValue: 1000000 },
    { currency: "INR", valuedOn: "2000-01-01" }, { currency: "EUR" }, {}, null,
  ])("rejects untrusted totals, identity, backdating or invalid capture input %j", async (body) => {
    expect((await POST(postRequest(body))).status).toBe(400);
    expect(sessionFrom).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("derives values and provider evidence from own holdings and server quotes", async () => {
    const response = await POST(postRequest());
    expect(response.status).toBe(200);
    expect(sessionQuery.eq.mock.calls.filter(([key]) => key === "user_id")).toEqual([["user_id", "owner"], ["user_id", "owner"]]);
    expect(mocks.getNormalizedQuotes.mock.calls[0][0].map((config: { symbol: string }) => config.symbol)).toEqual(["TCS.NS", "USDINR=X"]);
    expect(adminFrom).not.toHaveBeenCalled();
    expect(saveRpc).toHaveBeenCalledWith("save_portfolio_valuation_snapshot", { p_snapshot: expect.objectContaining({
      user_id: "owner", valuation_date: "2026-10-19", captured_at: "2026-10-19T00:30:00.000Z", holdings_observed_at: "2026-10-19T00:30:00.000Z", currency: "INR",
      invested_value: 1000, current_value: 1200, priced_holdings: 1, total_holdings: 1, coverage_complete: true,
      quote_sources: [expect.objectContaining({ symbol: "TCS.NS", provider: "yfinance", sessionDate: "2026-10-16" })],
    }) });
    // PostgreSQL derives the exact stored difference from the two numeric totals.
    expect(saveRpc.mock.calls[0][1].p_snapshot).not.toHaveProperty("pnl");
    expect(await response.json()).toMatchObject({ snapshot: { id: "s1", pnl: 200 }, methodology: expect.any(Array) });
  });

  it("upserts repeat captures into the same UTC-day and currency slot", async () => {
    await POST(postRequest());
    holdingsResults.push({ data: [holding], error: null }, { data: [holding], error: null });
    vi.setSystemTime(new Date("2026-10-19T23:59:00Z"));
    await POST(postRequest());
    expect(saveRpc).toHaveBeenCalledTimes(2);
    expect(saveRpc.mock.calls.map(([, { p_snapshot: row }]) => [row.user_id, row.valuation_date, row.currency])).toEqual([
      ["owner", "2026-10-19", "INR"], ["owner", "2026-10-19", "INR"],
    ]);
  });

  it("captures unknown partial coverage instead of substituting buy price", async () => {
    mocks.getNormalizedQuotes.mockResolvedValue([]);
    await POST(postRequest());
    expect(saveRpc.mock.calls[0][1].p_snapshot).toMatchObject({
      invested_value: null, current_value: null, pnl_percent: null, priced_holdings: 0, total_holdings: 1, coverage_complete: false,
      exclusions: [{ ticker: "TCS.NS", reason: "no-quote" }], quote_sources: [],
    });
  });

  it("records an actual empty book without spending a market-data request", async () => {
    holdingsResults = [{ data: [], error: null }, { data: [], error: null }];
    await POST(postRequest());
    expect(mocks.getNormalizedQuotes).not.toHaveBeenCalled();
    expect(saveRpc.mock.calls[0][1].p_snapshot).toMatchObject({ invested_value: 0, current_value: 0, pnl_percent: null, total_holdings: 0, coverage_complete: true });
  });

  it("asks for a retry if holdings change while provider prices are fetched", async () => {
    holdingsResults[1] = { data: [{ ...holding, quantity: 20 }], error: null };
    expect((await POST(postRequest())).status).toBe(409);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("bounds the book size before invoking market providers", async () => {
    holdingsResults[0] = { data: Array.from({ length: 201 }, () => holding), error: null };
    expect((await POST(postRequest())).status).toBe(422);
    expect(mocks.getNormalizedQuotes).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("throttles authenticated captures before reading or fetching the book", async () => {
    mocks.rateLimit.mockResolvedValue({ ok: false });
    expect((await POST(postRequest())).status).toBe(429);
    expect(sessionFrom).not.toHaveBeenCalled();
  });

  it("reports storage failures without claiming a successful capture or leaking database details", async () => {
    saveResult = { data: null, error: { message: "private table detail" } };
    const response = await POST(postRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Could not save this portfolio capture." });
  });

  it("reports migration/read failure instead of pretending history is empty", async () => {
    historyResult = { data: null, error: { message: "table missing" } };
    const response = await GET(getRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("snapshots");
  });
});
