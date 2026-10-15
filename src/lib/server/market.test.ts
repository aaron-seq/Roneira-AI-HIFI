import {
  toNumber,
  isUsEquitySymbol,
  getProviderSymbol,
  unwrapTwelveQuotePayload,
  normalizeQuote,
  dedupeBySymbol,
  splitMovers,
} from "@/lib/server/market";
import type { QuoteConfig, StockSearchResult } from "@/lib/market/types";
import { clearCachedValue } from "@/lib/server/cache";
import { getNormalizedQuotes } from "@/lib/server/market";

const equityConfig: QuoteConfig = {
  symbol: "AAPL",
  name: "Apple Inc.",
  exchange: "NASDAQ",
  assetType: "equity",
  currency: "USD",
};

describe("toNumber", () => {
  it("passes through finite numbers", () => {
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber(0)).toBe(0);
  });

  it("rejects non-finite numbers", () => {
    expect(toNumber(NaN)).toBeNull();
    expect(toNumber(Infinity)).toBeNull();
  });

  it("parses numeric strings, including comma-grouped values", () => {
    expect(toNumber("42.75")).toBe(42.75);
    expect(toNumber("1,234,567.25")).toBe(1234567.25);
  });

  it("returns null for values that are not numeric", () => {
    expect(toNumber("N/A")).toBeNull();
    expect(toNumber("")).toBeNull();
    expect(toNumber("   ")).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber({})).toBeNull();
  });
});

describe("isUsEquitySymbol", () => {
  it("accepts plain US tickers", () => {
    expect(isUsEquitySymbol("AAPL")).toBe(true);
  });

  it("rejects suffixed, index, futures and crypto symbols", () => {
    expect(isUsEquitySymbol("RELIANCE.NS")).toBe(false);
    expect(isUsEquitySymbol("^GSPC")).toBe(false);
    expect(isUsEquitySymbol("GC=F")).toBe(false);
    expect(isUsEquitySymbol("BTC-USD")).toBe(false);
  });
});

describe("getProviderSymbol", () => {
  it("prefers an explicit providerSymbol override", () => {
    expect(
      getProviderSymbol({ ...equityConfig, providerSymbol: "AAPL:NASDAQ" })
    ).toBe("AAPL:NASDAQ");
  });

  it("falls back to the symbol for plain US equities", () => {
    expect(getProviderSymbol(equityConfig)).toBe("AAPL");
  });

  it("returns undefined when the symbol is not a supported US equity", () => {
    expect(
      getProviderSymbol({ ...equityConfig, symbol: "RELIANCE.NS" })
    ).toBeUndefined();
  });

  it("returns undefined for non-equity asset types without an override", () => {
    expect(
      getProviderSymbol({ ...equityConfig, assetType: "commodity" })
    ).toBeUndefined();
  });
});

describe("unwrapTwelveQuotePayload", () => {
  it("wraps a single-quote payload keyed by its symbol", () => {
    const result = unwrapTwelveQuotePayload({ symbol: "AAPL", close: "150" });
    expect([...result.keys()]).toEqual(["AAPL"]);
    expect(result.get("AAPL")).toMatchObject({ symbol: "AAPL", close: "150" });
  });

  it("expands a batch payload and injects the symbol into each entry", () => {
    const result = unwrapTwelveQuotePayload({
      AAPL: { close: "150" },
      MSFT: { close: "400" },
    });

    expect([...result.keys()].sort()).toEqual(["AAPL", "MSFT"]);
    expect(result.get("MSFT")).toMatchObject({ symbol: "MSFT", close: "400" });
  });

  it("ignores non-object members of a batch payload", () => {
    const result = unwrapTwelveQuotePayload({
      AAPL: { close: "150" },
      status: "ok",
    });

    expect([...result.keys()]).toEqual(["AAPL"]);
  });
});

describe("normalizeQuote", () => {
  it("returns null when no usable price field is present", () => {
    expect(normalizeQuote(equityConfig, { volume: "10" }, "twelve-data")).toBeNull();
  });

  it("reads the price from the first available field in priority order", () => {
    expect(
      normalizeQuote(equityConfig, { price: "101", last: "999" }, "twelve-data")
        ?.price
    ).toBe(101);
    expect(
      normalizeQuote(equityConfig, { close: "100", price: "999" }, "twelve-data")
        ?.price
    ).toBe(100);
  });

  it("derives change and percent change from previousClose when absent", () => {
    const quote = normalizeQuote(
      equityConfig,
      { close: "110", previous_close: "100" },
      "twelve-data"
    );

    expect(quote?.change).toBe(10);
    expect(quote?.changePercent).toBeCloseTo(10);
    expect(quote?.changeAvailable).toBe(true);
    expect(quote?.changePercentAvailable).toBe(true);
  });

  it("prefers explicitly provided change fields over derived ones", () => {
    const quote = normalizeQuote(
      equityConfig,
      { close: "110", previous_close: "100", change: "5", percent_change: "5" },
      "twelve-data"
    );

    expect(quote?.change).toBe(5);
    expect(quote?.changePercent).toBe(5);
  });

  it("does not divide by zero when previousClose is zero or missing", () => {
    const noPrev = normalizeQuote(equityConfig, { close: "110" }, "twelve-data");
    expect(noPrev?.change).toBe(0);
    expect(noPrev?.changePercent).toBe(0);
    expect(noPrev?.changeAvailable).toBe(false);
    expect(noPrev?.changePercentAvailable).toBe(false);

    const zeroPrev = normalizeQuote(
      equityConfig,
      { close: "110", previous_close: "0" },
      "twelve-data"
    );
    expect(Number.isFinite(zeroPrev?.changePercent ?? NaN)).toBe(true);
    expect(zeroPrev?.changeAvailable).toBe(false);
    expect(zeroPrev?.changePercentAvailable).toBe(false);
  });

  it("preserves a reported flat percentage separately from an unknown move", () => {
    const flat = normalizeQuote(equityConfig, { close: 110, change: 0, percent_change: 0 }, "twelve-data");
    expect(flat?.changePercent).toBe(0);
    expect(flat?.changeAvailable).toBe(true);
    expect(flat?.changePercentAvailable).toBe(true);
    const percentageOnly = normalizeQuote(equityConfig, { close: 110, percent_change: 5 }, "twelve-data");
    expect(percentageOnly?.changeAvailable).toBe(false);
    expect(percentageOnly?.changePercentAvailable).toBe(true);
  });

  it("retains explicit provider unavailability despite legacy numeric zeros", () => {
    const unavailable = normalizeQuote(equityConfig, {
      price: 110, change: 0, change_percent: 0,
      change_available: false, change_percent_available: false,
    }, "yfinance");
    expect(unavailable?.changePercentAvailable).toBe(false);
    expect(unavailable?.changeAvailable).toBe(false);
  });

  it("falls back to the configured metadata when the payload omits it", () => {
    const quote = normalizeQuote(equityConfig, { close: "150" }, "twelve-data");

    expect(quote).toMatchObject({
      symbol: "AAPL",
      name: "Apple Inc.",
      exchange: "NASDAQ",
      currency: "USD",
      assetType: "equity",
      provider: "twelve-data",
    });
  });

  it("prefers payload metadata when present", () => {
    const quote = normalizeQuote(
      equityConfig,
      { close: "150", name: "Apple Computer", exchange: "NYSE", currency: "EUR" },
      "twelve-data"
    );

    expect(quote).toMatchObject({
      name: "Apple Computer",
      exchange: "NYSE",
      currency: "EUR",
    });
  });

  it("nulls out optional OHLC fields that are absent rather than guessing", () => {
    const quote = normalizeQuote(equityConfig, { close: "150" }, "twelve-data");

    expect(quote?.high).toBeNull();
    expect(quote?.low).toBeNull();
    expect(quote?.open).toBeNull();
    expect(quote?.volume).toBeNull();
  });

  it("does not invent a provider timestamp or session for an undated quote", () => {
    const quote = normalizeQuote(equityConfig, { close: "150" }, "twelve-data");
    expect(quote?.timestamp).toBeNull();
    expect(quote?.sessionDate).toBeNull();
  });

  it("retains a stale provider time and derives the date in the exchange timezone", () => {
    const asOf = "2026-10-02T00:30:00Z";
    const quote = normalizeQuote(equityConfig, {
      close: "150", timestamp: Date.parse(asOf) / 1000,
      exchange_timezone: "America/New_York",
    }, "twelve-data");
    expect(quote?.timestamp).toBe(asOf.replace("Z", ".000Z"));
    expect(quote?.sessionDate).toBe("2026-10-01");
    expect(quote?.sessionTimezone).toBe("America/New_York");
  });

  it("retains the Yahoo daily session without treating midnight as a quote time", () => {
    const quote = normalizeQuote({ ...equityConfig, symbol: "TCS.NS", exchange: "NSE" }, {
      price: 3000, session_date: "2026-10-09", session_timezone: "Asia/Kolkata",
      timestamp: null,
    }, "yfinance");
    expect(quote).toMatchObject({ timestamp: null, sessionDate: "2026-10-09", sessionTimezone: "Asia/Kolkata" });
  });

  it("preserves Twelve Data's exchange-local session without guessing an offset", () => {
    const quote = normalizeQuote(equityConfig, {
      close: "150", datetime: "2026-10-09 16:00:00", exchange_timezone: "America/New_York",
    }, "twelve-data");
    expect(quote?.timestamp).toBeNull();
    expect(quote?.sessionDate).toBe("2026-10-09");
  });

  it("rejects malformed session dates and unknown timezone provenance", () => {
    const quote = normalizeQuote(equityConfig, {
      close: "150", session_date: "2026-02-30", timestamp: "invalid",
      exchange_timezone: "Unknown/Exchange",
    }, "twelve-data");
    expect(quote).toMatchObject({ timestamp: null, sessionDate: null, sessionTimezone: null });
  });
});

describe("ML quote batching", () => {
  beforeEach(() => clearCachedValue());
  afterEach(() => vi.unstubAllGlobals());

  const config = (symbol: string): QuoteConfig => ({ ...equityConfig, symbol, exchange: "NSE" });
  const reply = (symbols: string[]) => new Response(JSON.stringify({
    data: symbols.map((symbol) => ({ symbol, price: 100, session_date: "2026-10-09", session_timezone: "Asia/Kolkata" })),
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  it.each([
    { total: 20, batchSizes: [20] },
    { total: 21, batchSizes: [20, 1] },
    { total: 45, batchSizes: [20, 20, 5] },
  ])("fetches all $total symbols including trailing FX for a mixed portfolio", async ({ total, batchSizes }) => {
    const configs: QuoteConfig[] = Array.from({ length: total - 1 }, (_, i) => i % 2 === 0
      ? { ...equityConfig, symbol: `HOLDING${i}.NS`, exchange: "NSE", currency: "INR" }
      : { ...equityConfig, symbol: `USHOLDING${i}`, exchange: "NASDAQ", currency: "USD" });
    configs.push({ ...equityConfig, symbol: "USDINR=X", exchange: "FX", assetType: "forex", currency: "INR" });
    const symbols = configs.map((entry) => entry.symbol);
    const batches: string[][] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "api.twelvedata.com") return new Response("{}", { status: 503 });
      const batch = url.searchParams.get("symbols")!.split(",");
      batches.push(batch);
      return reply(batch);
    }));

    const quotes = await getNormalizedQuotes(configs);
    expect(batches.map((batch) => batch.length)).toEqual(batchSizes);
    expect(quotes.map((quote) => quote.symbol)).toEqual(symbols);
    expect(quotes.at(-1)?.symbol).toBe("USDINR=X");
  });

  it("keeps later batches when an earlier ML request fails", async () => {
    const symbols = Array.from({ length: 21 }, (_, i) => `BATCH${i}.NS`);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "api.twelvedata.com") return new Response("{}", { status: 503 });
      const batch = url.searchParams.get("symbols")!.split(",");
      return batch.length === 20 ? new Response("{}", { status: 503 }) : reply(batch);
    }));

    expect((await getNormalizedQuotes(symbols.map(config))).map((quote) => quote.symbol)).toEqual(["BATCH20.NS"]);
  });
});

describe("dedupeBySymbol", () => {
  const row = (symbol: string, name: string): StockSearchResult => ({
    symbol,
    name,
    exchange: "NSE",
    type: "Common Stock",
    provider: "finnhub",
  });

  it("collapses repeated symbols, keeping one entry per symbol", () => {
    // Finnhub returns RELIANCE.NS twice under different descriptions, which
    // broke list rendering for consumers keying on symbol.
    const results = dedupeBySymbol([
      row("RELIANCE.NS", "RELIANCE INDUSTRIES LIMITED"),
      row("RELIANCE.NS", "Reliance Industries Ltd"),
      row("RPOWER.NS", "Reliance Power Ltd"),
    ]);

    expect(results.map((entry) => entry.symbol)).toEqual([
      "RELIANCE.NS",
      "RPOWER.NS",
    ]);
  });

  it("leaves already-unique results untouched", () => {
    const unique = [row("AAPL", "Apple Inc."), row("MSFT", "Microsoft")];
    expect(dedupeBySymbol(unique)).toHaveLength(2);
  });
});

describe("splitMovers", () => {
  const quote = (symbol: string, changePercent: number) =>
    ({ symbol, changePercent }) as Parameters<typeof splitMovers>[0][number];

  it("never lists a stock that rose as a loser, or one that fell as a gainer", () => {
    const { gainers, losers } = splitMovers(
      [quote("A", 3), quote("B", 1.2), quote("C", 0.4), quote("D", -0.5), quote("E", -2)],
      5
    );
    expect(gainers.map((q) => q.symbol)).toEqual(["A", "B", "C"]);
    expect(losers.map((q) => q.symbol)).toEqual(["E", "D"]);
  });

  it("returns empty lists on a day when nothing moved that way", () => {
    expect(splitMovers([quote("A", 1), quote("B", 2)]).losers).toEqual([]);
  });

  it("does not rank unavailable or nonfinite moves", () => {
    const result = splitMovers([
      { ...quote("UNKNOWN", 5), changePercentAvailable: false },
      quote("INVALID", Infinity), quote("KNOWN", 2),
    ]);
    expect(result.gainers.map((q) => q.symbol)).toEqual(["KNOWN"]);
  });
});
