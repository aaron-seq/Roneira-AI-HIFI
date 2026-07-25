import {
  toNumber,
  isUsEquitySymbol,
  getProviderSymbol,
  unwrapTwelveQuotePayload,
  normalizeQuote,
} from "@/lib/server/market";
import type { QuoteConfig } from "@/lib/market/types";

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

    const zeroPrev = normalizeQuote(
      equityConfig,
      { close: "110", previous_close: "0" },
      "twelve-data"
    );
    expect(Number.isFinite(zeroPrev?.changePercent ?? NaN)).toBe(true);
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

  it("stamps an ISO timestamp", () => {
    const quote = normalizeQuote(equityConfig, { close: "150" }, "twelve-data");
    expect(() => new Date(quote!.timestamp).toISOString()).not.toThrow();
  });
});
