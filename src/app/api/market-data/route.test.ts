import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/lib/server/rate-limit", () => ({
  rateLimit: async () => ({ ok: gate.allowed }),
  tooManyRequests: () => Response.json({ error: "Too many requests" }, { status: 429 }),
}));

const origin = "https://ml.example.test";
const token = "test-service-token";
const privateDetail = "test-private-upstream-detail";
const quotePath = "/api/market-data?symbols=%5ENSEI";
const historyPath = "/api/market-data/history?symbol=%5ENSEI&interval=1day&range=1month";
const candle = { time: "2026-10-20", open: 100, high: 102, low: 99, close: 101, volume: 1000 };
const json = (body: unknown, status = 200) => Response.json(body, { status });
const rows = (symbols: string[]) => ({ data: symbols.map((symbol) => ({
  symbol, price: 101, change: 1, change_percent: 1,
  session_date: "2026-10-20", session_timezone: "Asia/Kolkata",
})) });

async function request(path = quotePath) {
  const route = path.startsWith("/api/market-data/history")
    ? await import("./history/route") : await import("./route");
  return route.GET(new Request("https://app.example.test" + path));
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ML_BACKEND_URL", origin);
  vi.stubEnv("ML_SERVICE_TOKEN", token);
  vi.stubEnv("TWELVE_DATA_API_KEY", "");
  vi.stubEnv("FINNHUB_API_KEY", "");
  vi.stubEnv("ALPHA_VANTAGE_API_KEY", "");
  (await import("@/lib/server/cache")).clearCachedValue();
  gate.allowed = true;
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("market backend configuration", () => {
  it.each([
    ["unset", undefined, token], ["empty", "", token], ["whitespace", "  ", token],
    ["malformed", "not a URL", token], ["HTTP", "http://ml.example.test", token],
    ["localhost", "https://localhost", token], ["localhost alias", "https://api.localhost.", token],
    ["IPv4 loopback", "https://127.0.0.1", token], ["numeric loopback", "https://2130706433", token],
    ["IPv6 loopback", "https://[::1]", token], ["credentials", "https://user:password@ml.example.test", token],
    ["endpoint path", origin + "/health", token], ["missing token", origin, ""],
    ["whitespace token", origin, "   "],
  ])("rejects %s configuration before contacting ML", async (_name, url, sharedToken) => {
    vi.stubEnv("ML_BACKEND_URL", url);
    vi.stubEnv("ML_SERVICE_TOKEN", sharedToken);
    const fetch = vi.fn(async () => json(rows(["^NSEI"])));
    vi.stubGlobal("fetch", fetch);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await request();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Market service is not configured.", code: "ML_SERVICE_CONFIGURATION_ERROR" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(fetch).not.toHaveBeenCalled();
    const logged = inspect(log.mock.calls);
    expect(logged).not.toContain(origin);
    expect(logged).not.toContain(token);
    expect(logged).not.toContain("user:password");
  });

  it("uses the same configuration failure for history", async () => {
    vi.stubEnv("ML_BACKEND_URL", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await request(historyPath)).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retains authenticated localhost fallback in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ML_BACKEND_URL", "");
    const fetch = vi.fn(async () => json(rows(["^NSEI"])));
    vi.stubGlobal("fetch", fetch);
    expect((await request()).status).toBe(200);
    const [url, options] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).origin).toBe("http://localhost:8000");
    expect(new Headers(options.headers).get("x-ml-service-token")).toBe(token);
    expect(options.redirect).toBe("error");
  });

  it("does not validate unused ML configuration when rate limited", async () => {
    gate.allowed = false;
    vi.stubEnv("ML_BACKEND_URL", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await request()).status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("recovers the same cache key after configuration is repaired", async () => {
    vi.stubEnv("ML_BACKEND_URL", "");
    const fetch = vi.fn(async () => json(rows(["^NSEI"])));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await request()).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv("ML_BACKEND_URL", origin);
    const recovered = await request();
    expect(recovered.status).toBe(200);
    expect((await recovered.json()).data).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("provider independence and empty data", () => {
  it.each(["quotes", "history"])("keeps healthy Twelve Data %s without ML configuration", async (kind) => {
    vi.stubEnv("TWELVE_DATA_API_KEY", "test-provider-key");
    vi.stubEnv("ML_BACKEND_URL", "");
    vi.stubEnv("ML_SERVICE_TOKEN", "");
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(new URL(String(input)).hostname).toBe("api.twelvedata.com");
      expect(new Headers(init?.headers).has("x-ml-service-token")).toBe(false);
      return kind === "quotes"
        ? json({ symbol: "AAPL", close: "101", previous_close: "100" })
        : json({ values: [{ ...candle, datetime: candle.time }] });
    });
    vi.stubGlobal("fetch", fetch);
    const path = kind === "quotes" ? "/api/market-data?symbols=AAPL" : "/api/market-data/history?symbol=AAPL&range=1month";
    const response = await request(path);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(kind === "quotes" ? body.data[0].price : body.candles[0].close).toBe(101);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([quotePath, historyPath])("preserves a successful empty response for %s", async (path) => {
    const fetch = vi.fn(async () => json(path === quotePath ? { data: [] } : { candles: [] }));
    vi.stubGlobal("fetch", fetch);
    const response = await request(path);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(path === quotePath ? body.data : body.candles).toEqual([]);
    expect((await request(path)).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("ML rejection and transport failures", () => {
  it.each([quotePath, historyPath].flatMap((path) => ["401", "503", "network", "invalid JSON", "bad envelope", "redirect"].map((failure) => ({ path, failure }))))(
    "returns a safe502 for $failure at $path", async ({ path, failure }) => {
      const fetch = vi.fn(async () => {
        if (failure === "network") throw new Error(`${origin}/${token}/${privateDetail}`);
        if (failure === "invalid JSON") return new Response(`${privateDetail}: ${token}`);
        if (failure === "bad envelope") return json({ unrelated: privateDetail });
        if (failure === "redirect") return new Response(null, { status: 302, headers: { Location: "https://other.example.test/" } });
        return json({ detail: `${origin}/${token}/${privateDetail}` }, Number(failure));
      });
      vi.stubGlobal("fetch", fetch);
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const timeout = vi.spyOn(AbortSignal, "timeout");

      const response = await request(path);

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: "Market service is temporarily unavailable.", code: "ML_SERVICE_UNAVAILABLE" });
      expect(timeout).toHaveBeenCalledWith(10_000);
      const logged = inspect(log.mock.calls, { depth: 8 });
      for (const sentinel of [origin, token, privateDetail]) expect(logged).not.toContain(sentinel);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].redirect).toBe("error");
    });

  it("retries the same key immediately after upstream recovery", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ detail: privateDetail }, 503))
      .mockImplementation(async () => json(rows(["^NSEI"])));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await request()).status).toBe(502);
    const response = await request();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("usable partial data", () => {
  it("retains primary-provider data when the remaining ML fallback fails", async () => {
    vi.stubEnv("TWELVE_DATA_API_KEY", "test-provider-key");
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (new URL(String(input)).hostname === "api.twelvedata.com") {
        expect(new Headers(init?.headers).has("x-ml-service-token")).toBe(false);
        return json({ symbol: "AAPL", close: "101", previous_close: "100" });
      }
      return json({ detail: `${privateDetail}/${token}` }, 503);
    });
    vi.stubGlobal("fetch", fetch);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await request("/api/market-data?symbols=AAPL,%5ENSEI");
    expect(response.status).toBe(200);
    expect((await response.json()).data.map((q: { symbol: string }) => q.symbol)).toEqual(["AAPL"]);
    expect(inspect(log.mock.calls)).not.toContain(token);
    expect(inspect(log.mock.calls)).not.toContain(privateDetail);
  });

  it.each(["first", "last"])("keeps valid quotes when the %s batch fails", async (failed) => {
    const symbols = Array.from({ length: 21 }, (_, n) => `STOCK${n}.NS`);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const batch = new URL(String(input)).searchParams.get("symbols")!.split(",");
      return (batch.length === 20) === (failed === "first") ? json({}, 503) : json(rows(batch));
    }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await request("/api/market-data?symbols=" + symbols.join(","));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toHaveLength(failed === "first" ? 1 : 20);
  });

  it("does not mistake an empty successful batch for recovery from a failed batch", async () => {
    const symbols = Array.from({ length: 21 }, (_, n) => `STOCK${n}.NS`);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const batch = new URL(String(input)).searchParams.get("symbols")!.split(",");
      return batch.length === 20 ? json({}, 503) : json({ data: [] });
    }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await request("/api/market-data?symbols=" + symbols.join(","))).status).toBe(502);
  });

  it.each(["overview", "movers", "both", "empty"])("preserves available overview groups: $0", async (failed) => {
    const { MARKET_OVERVIEW_SYMBOLS } = await import("@/lib/market/constants");
    const overview = new Set(MARKET_OVERVIEW_SYMBOLS.map((entry) => entry.fallbackSymbol ?? entry.symbol));
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const batch = new URL(String(input)).searchParams.get("symbols")!.split(",");
      const isOverview = batch.some((symbol) => overview.has(symbol));
      if (failed === "both" || (isOverview ? failed === "overview" : failed === "movers")) return json({}, 503);
      return json(failed === "empty" ? { data: [] } : rows(batch));
    }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await request("/api/market-data?group=market-overview");
    expect(response.status).toBe(failed === "both" ? 502 : 200);
    const body = await response.json();
    if (failed === "overview") { expect(body.data).toEqual([]); expect(body.movers.gainers.length).toBeGreaterThan(0); }
    if (failed === "movers") { expect(body.data.length).toBeGreaterThan(0); expect(body.movers.gainers).toEqual([]); }
    if (failed === "empty") { expect(body.data).toEqual([]); expect(body.movers.gainers).toEqual([]); }
  });
});
