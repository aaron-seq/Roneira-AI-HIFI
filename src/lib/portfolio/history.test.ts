import { describe, expect, it } from "vitest";
import type { MarketQuote } from "@/lib/market/types";
import type { HoldingInput } from "@/lib/portfolio/summary";
import { buildPortfolioCapture } from "./history";
import { historyStartDate, holdingsFingerprint, snapshotFromRow } from "@/lib/server/portfolio-history";
import { createSymbolConfig } from "@/lib/market/constants";
import { normalizeQuote } from "@/lib/server/market";

const now = new Date("2026-10-19T00:30:00Z");
const holding = (ticker: string, overrides: Partial<HoldingInput> = {}): HoldingInput => ({
  id: ticker, ticker, exchange: "NSE", quantity: 10, avg_buy_price: 100, sector: "Technology", ...overrides,
});
const quote = (symbol: string, overrides: Partial<MarketQuote> = {}): MarketQuote => ({
  symbol, name: symbol, exchange: "NSE", assetType: "equity", currency: "INR", price: 120,
  change: 1, changePercent: 1, provider: "yfinance", timestamp: "2026-10-16T10:00:00Z",
  sessionDate: "2026-10-16", sessionTimezone: "Asia/Kolkata", ...overrides,
});

describe("captured portfolio history", () => {
  it.each(["INR", "USD"] as const)("includes mixed holdings in %s using the actual direct-symbol normalization path", (currency) => {
    const quotes = ["TCS.NS", "AAPL", "USDINR=X"].map((symbol) =>
      normalizeQuote(createSymbolConfig(symbol), { close: symbol === "USDINR=X" ? 80 : 120 }, "yfinance")!
    );
    const capture = buildPortfolioCapture(
      [holding("TCS.NS"), holding("AAPL", { exchange: "NASDAQ" })], quotes, currency, now,
    );
    expect(capture).toMatchObject({
      totalHoldings: 2, pricedHoldings: 2, coverageComplete: true, exclusions: [], usdInr: 80,
      investedValue: currency === "INR" ? 81000 : 1012.5,
      currentValue: currency === "INR" ? 97200 : 1215,
    });
    expect(capture.quoteSources).toHaveLength(3);
  });

  it("saves a UTC capture date separately from the provider's older exchange session", () => {
    const capture = buildPortfolioCapture([holding("TCS.NS")], [quote("TCS.NS")], "INR", now);
    expect(capture).toMatchObject({
      valuedOn: "2026-10-19", capturedAt: now.toISOString(), investedValue: 1000, currentValue: 1200,
      pnl: 200, pnlPercent: 20, totalHoldings: 1, pricedHoldings: 1, coverageComplete: true,
      quoteSources: [{ symbol: "TCS.NS", provider: "yfinance", timestamp: "2026-10-16T10:00:00.000Z", sessionDate: "2026-10-16", usedFor: "holding" }],
    });
    expect(capture.quoteSources[0]).not.toHaveProperty("price");
  });

  it("keeps actual empty-book zero distinct from a nonempty unpriced book", () => {
    expect(buildPortfolioCapture([], [], "INR", now)).toMatchObject({
      totalHoldings: 0, pricedHoldings: 0, coverageComplete: true, investedValue: 0, currentValue: 0, pnl: 0, pnlPercent: null,
    });
    expect(buildPortfolioCapture([holding("TCS.NS")], [], "INR", now)).toMatchObject({
      totalHoldings: 1, pricedHoldings: 0, coverageComplete: false, investedValue: null, currentValue: null, pnl: null, pnlPercent: null,
      exclusions: [{ ticker: "TCS.NS", reason: "no-quote" }], quoteSources: [],
    });
  });

  it("records partial coverage and the cost basis of exactly the priced subset", () => {
    const capture = buildPortfolioCapture([holding("TCS.NS"), holding("INFY.NS")], [quote("TCS.NS")], "INR", now);
    expect(capture).toMatchObject({
      investedValue: 1000, currentValue: 1200, pnl: 200, totalHoldings: 2, pricedHoldings: 1, coverageComplete: false,
      exclusions: [{ ticker: "INFY.NS", reason: "no-quote" }],
    });
  });

  it("retains a zero-cost holding's absolute gain without inventing a percentage", () => {
    const capture = buildPortfolioCapture([holding("GIFT.NS", { avg_buy_price: 0 })], [quote("GIFT.NS")], "INR", now);
    expect(capture).toMatchObject({ investedValue: 0, currentValue: 1200, pnl: 1200, pnlPercent: null, pricedHoldings: 1 });
  });

  it("records current FX and its provenance for a mixed-currency book", () => {
    const capture = buildPortfolioCapture(
      [holding("TCS.NS"), holding("AAPL", { exchange: "NASDAQ" })],
      [quote("TCS.NS"), quote("AAPL", { exchange: "NASDAQ", currency: "USD" }), quote("USDINR=X", { price: 80, assetType: "forex" })],
      "INR", now,
    );
    expect(capture).toMatchObject({ investedValue: 81000, currentValue: 97200, pnl: 16200, usdInr: 80, pricedHoldings: 2, coverageComplete: true });
    expect(capture.quoteSources).toHaveLength(3);
    expect(capture.quoteSources[2]).toMatchObject({ symbol: "USDINR=X", usedFor: "currency-conversion" });
  });

  it.each([0, -1, NaN, Infinity])("excludes foreign holdings with invalid FX (%s)", (price) => {
    const capture = buildPortfolioCapture(
      [holding("TCS.NS"), holding("AAPL", { exchange: "NASDAQ" })],
      [quote("TCS.NS"), quote("AAPL", { currency: "USD" }), quote("USDINR=X", { price })], "INR", now,
    );
    expect(capture).toMatchObject({ currentValue: 1200, pricedHoldings: 1, usdInr: null, exclusions: [{ ticker: "AAPL", reason: "no-fx-rate" }] });
    expect(capture.quoteSources).toHaveLength(1);
  });

  it("rejects a mismatched quote currency instead of counting dollars as rupees", () => {
    const capture = buildPortfolioCapture([holding("TCS.NS")], [quote("TCS.NS", { currency: "USD" })], "INR", now);
    expect(capture).toMatchObject({ currentValue: null, exclusions: [{ ticker: "TCS.NS", reason: "quote-currency-mismatch" }] });
  });

  it("keeps unknown source times unknown instead of substituting capture time", () => {
    const capture = buildPortfolioCapture([holding("TCS.NS")], [quote("TCS.NS", { timestamp: "bad-date", sessionDate: "2026-99-99", sessionTimezone: null })], "INR", now);
    expect(capture.quoteSources[0]).toMatchObject({ timestamp: null, sessionDate: null, sessionTimezone: null });
  });

  it.each(["2026-10-16", "2026-10-16T10:00:00", "2026-02-30T10:00:00Z"])("does not promote a session label or unzoned/invalid timestamp into a provider as-of time (%s)", (timestamp) => {
    const capture = buildPortfolioCapture([holding("TCS.NS")], [quote("TCS.NS", { timestamp })], "INR", now);
    expect(capture.quoteSources[0].timestamp).toBeNull();
  });

  it("preserves the first holdings observation independently of completion time", () => {
    const observed = new Date("2026-10-18T23:59:58Z");
    const capture = buildPortfolioCapture([holding("TCS.NS")], [quote("TCS.NS")], "INR", now, observed);
    expect(capture.holdingsObservedAt).toBe("2026-10-18T23:59:58.000Z");
    expect(capture.capturedAt).toBe(now.toISOString());
    expect(capture.valuedOn).toBe("2026-10-19");
  });

  it.each([{ quantity: Infinity }, { avg_buy_price: NaN }, { quantity: 1e308 }])("does not put nonfinite holding values into JSON (%j)", (invalid) => {
    const capture = buildPortfolioCapture([holding("TCS.NS", invalid)], [quote("TCS.NS")], "INR", now);
    expect(capture.currentValue).toBeNull();
    expect(capture.pnlPercent).toBeNull();
    expect(capture.pricedHoldings).toBe(0);
    expect(capture.quoteSources).toEqual([]);
  });

  it("bounds an inclusive UTC day range across a year boundary", () => {
    expect(historyStartDate(new Date("2027-01-01T23:59:59Z"), 1)).toBe("2027-01-01");
    expect(historyStartDate(new Date("2027-01-01T23:59:59Z"), 3)).toBe("2026-12-30");
  });

  it("detects cost, quantity and membership edits while ignoring row order", () => {
    const a = { ...holding("A"), updated_at: "2026-10-19T00:00:00Z" };
    const b = { ...holding("B"), updated_at: "2026-10-19T00:00:00Z" };
    expect(holdingsFingerprint([a, b])).toBe(holdingsFingerprint([b, a]));
    expect(holdingsFingerprint([a])).not.toBe(holdingsFingerprint([{ ...a, quantity: 20 }]));
    expect(holdingsFingerprint([a])).not.toBe(holdingsFingerprint([{ ...a, avg_buy_price: 101 }]));
    expect(holdingsFingerprint([a])).not.toBe(holdingsFingerprint([a, b]));
  });

  it("rejects invalid database numeric output rather than returning JSON null as an observed result", () => {
    expect(() => snapshotFromRow({ current_value: "Infinity" } as Parameters<typeof snapshotFromRow>[0])).toThrow("Invalid stored portfolio valuation");
  });
});
