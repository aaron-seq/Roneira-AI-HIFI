import { describe, expect, it } from "vitest";
import type { MarketQuote, QuoteConfig } from "@/lib/market/types";
import { summarisePortfolio, type HoldingInput } from "@/lib/portfolio/summary";
import { buildMarketStories, buildPortfolioStories, type InsightStories } from "./stories";

const config = (symbol: string, region = "india", assetType: QuoteConfig["assetType"] = "index"): QuoteConfig => ({
  symbol, region, assetType, name: symbol, exchange: "NSE", currency: "INR",
});
const quote = (symbol: string, overrides: Partial<MarketQuote> = {}): MarketQuote => ({
  symbol, name: symbol, exchange: "NSE", assetType: "index", currency: "INR",
  price: 100, change: 1, changePercent: 1, changePercentAvailable: true,
  provider: "yfinance", timestamp: "2026-10-09T10:00:00Z",
  sessionDate: "2026-10-09", sessionTimezone: "Asia/Kolkata", ...overrides,
});
const holding = (ticker: string, overrides: Partial<HoldingInput> = {}): HoldingInput => ({
  id: ticker, ticker, exchange: "NSE", quantity: 10, avg_buy_price: 100, sector: "Technology", ...overrides,
});
const body = (insights: InsightStories, id: string) => insights.stories.find((story) => story.id === id)?.body ?? "";

describe("market insight calculations", () => {
  it("distinguishes higher, lower, observed unchanged, and absent comparisons", () => {
    const insights = buildMarketStories({
      configs: [config("UP"), config("DOWN"), config("FLAT"), config("UNKNOWN"), config("MISSING")],
      quotes: [quote("UP"), quote("DOWN", { changePercent: -2 }), quote("FLAT", { changePercent: 0 }),
        quote("UNKNOWN", { changePercent: 0, changePercentAvailable: false })],
    });
    expect(body(insights, "market-india")).toContain("1 higher, 1 lower, and 1 unchanged");
    expect(body(insights, "market-india")).toContain("3 of 5 tracked indices");
    expect(body(insights, "market-coverage")).toContain("4 of 5");
    expect(body(insights, "market-coverage")).toContain("1 have no usable quote");
  });

  it("does not infer observed movement for older quotes lacking comparison provenance", () => {
    const insights = buildMarketStories({ configs: [config("OLD")], quotes: [quote("OLD", { changePercentAvailable: undefined })] });
    expect(body(insights, "market-india")).toContain("comparisons are unavailable");
    expect(body(insights, "market-india")).not.toContain("unchanged");
    expect(body(insights, "market-coverage")).toContain("1 of 1");
  });

  it("deduplicates configured symbols and quotes and excludes special indicators", () => {
    const insights = buildMarketStories({
      configs: [config("NIFTY"), config("NIFTY"), config("VIX", "india", "volatility"), config("DXY", "special"), config("YIELD", "us", "yield")],
      quotes: [quote("NIFTY"), quote("NIFTY"), quote("VIX", { changePercent: 25 }), quote("DXY"), quote("YIELD")],
    });
    expect(body(insights, "market-coverage")).toContain("1 of 1");
    expect(body(insights, "market-india")).toContain("1 higher, 0 lower, and 0 unchanged");
    expect(insights.stories).toHaveLength(2);
  });

  it("rejects nonfinite or nonpositive prices and nonfinite moves", () => {
    const insights = buildMarketStories({
      configs: [config("INF"), config("NAN"), config("ZERO"), config("NEGATIVE"), config("NO_MOVE")],
      quotes: [quote("INF", { price: Infinity }), quote("NAN", { price: NaN }), quote("ZERO", { price: 0 }),
        quote("NEGATIVE", { price: -2 }), quote("NO_MOVE", { changePercent: NaN })],
    });
    expect(body(insights, "market-coverage")).toContain("1 of 5");
    expect(body(insights, "market-india")).toContain("comparisons are unavailable for all 5");
    expect(JSON.stringify(insights)).not.toContain("NaN");
    expect(JSON.stringify(insights)).not.toContain("Infinity");
  });

  it("reports movement separately for each regional sample", () => {
    const insights = buildMarketStories({
      configs: [config("INDIA"), config("US", "us"), config("EUROPE", "europe")],
      quotes: [quote("INDIA"), quote("US", { changePercent: -1 }), quote("EUROPE", { changePercent: 0 })],
    });
    expect(body(insights, "market-india")).toContain("1 higher");
    expect(body(insights, "market-us")).toContain("0 higher, 1 lower");
    expect(body(insights, "market-europe")).toContain("0 higher, 0 lower, and 1 unchanged");
    expect(insights.methodology.join(" ")).toContain("not all stocks or full-market breadth");
  });

  it("keeps provider timestamps, mixed sessions, and missing provenance distinct", () => {
    const insights = buildMarketStories({
      configs: [config("INDIA"), config("US", "us"), config("UNKNOWN")],
      quotes: [quote("INDIA"), quote("US", { provider: "twelve-data", timestamp: "2026-10-12T16:00:00-04:00", sessionDate: "2026-10-12", sessionTimezone: "America/New_York" }),
        quote("UNKNOWN", { timestamp: null, sessionDate: null, sessionTimezone: null })],
    });
    expect(insights.sourceNote).toContain("Twelve Data, Yahoo Finance");
    expect(insights.sourceNote).toContain("2026-10-09 10:00:00 UTC to 2026-10-12 20:00:00 UTC");
    expect(insights.sourceNote).toContain("Exchange sessions: 2026-10-09 to 2026-10-12");
    expect(insights.sourceNote).toContain("1 of 3 quotes have no provider as-of time");
    expect(insights.sourceNote).toContain("1 of 3 quotes have no exchange session date");
    expect(insights.methodology.join(" ")).toContain("page refresh does not establish quote freshness");
  });

  it("rejects invalid dates and a date-only value masquerading as an as-of timestamp", () => {
    const insights = buildMarketStories({
      configs: [config("INVALID")],
      quotes: [quote("INVALID", { timestamp: "2026-10-09", sessionDate: "2026-02-30" })],
    });
    expect(insights.sourceNote).toContain("no provider as-of time");
    expect(insights.sourceNote).toContain("no exchange session date");
    expect(insights.sourceNote).not.toContain("Exchange sessions:");
  });

  it("discloses missing session timezones rather than assigning the known quote's timezone", () => {
    const insights = buildMarketStories({
      configs: [config("KNOWN"), config("UNKNOWN_ZONE", "us")],
      quotes: [quote("KNOWN"), quote("UNKNOWN_ZONE", { sessionDate: "2026-10-12", sessionTimezone: null })],
    });
    expect(insights.sourceNote).toContain("Exchange sessions: 2026-10-09 to 2026-10-12 (Asia/Kolkata)");
    expect(insights.sourceNote).toContain("1 dated quotes have no session timezone");
  });

  it("provides an honest empty result without inserting sample prices or a current date", () => {
    const insights = buildMarketStories({ configs: [], quotes: [] });
    expect(body(insights, "market-coverage")).toContain("No regional indices are configured");
    expect(insights.sourceNote).toBe("Provider times and exchange session dates are unavailable.");
    expect(JSON.stringify(insights)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("portfolio insight calculations", () => {
  it("uses converted marked values and cost bases for mixed INR and USD holdings", () => {
    const holdings = [holding("TCS.NS", { avg_buy_price: 3000 }), holding("AAPL", { exchange: "NASDAQ", avg_buy_price: 150 })];
    const quotes = [quote("TCS.NS", { price: 3300 }), quote("AAPL", { price: 200, currency: "USD" }), quote("USDINR=X", { price: 80, assetType: "forex" })];
    const summary = summarisePortfolio(holdings, new Map(quotes.map((value) => [value.symbol, value])), 80, "INR");
    const insights = buildPortfolioStories({ summary, quotes });
    expect(body(insights, "portfolio-coverage")).toContain("2 of 2 holdings are included in the INR valuation");
    expect(body(insights, "portfolio-pnl")).toContain("₹1,93,000.00");
    expect(body(insights, "portfolio-pnl")).toContain("gain of ₹43,000.00");
    expect(body(insights, "portfolio-pnl")).toContain("28.7% of its converted cost basis");
    expect(body(insights, "portfolio-concentration")).toContain("AAPL represents 82.9% of the priced, convertible book");
    expect(insights.methodology.join(" ")).toContain("₹80.00 per USD");
    expect(insights.methodology.join(" ")).toContain("cost basis use the same supplied current rate");
  });

  it("changes the reporting currency without adding rupees and dollars", () => {
    const holdings = [holding("TCS.NS", { avg_buy_price: 3000 }), holding("AAPL", { exchange: "NASDAQ", avg_buy_price: 150 })];
    const quotes = [quote("TCS.NS", { price: 3300 }), quote("AAPL", { price: 200 }), quote("USDINR=X", { price: 80 })];
    const summary = summarisePortfolio(holdings, new Map(quotes.map((value) => [value.symbol, value])), 80, "USD");
    const insights = buildPortfolioStories({ summary, quotes });
    expect(body(insights, "portfolio-coverage")).toContain("USD valuation");
    expect(body(insights, "portfolio-pnl")).toContain("$2,412.50");
    expect(body(insights, "portfolio-pnl")).toContain("gain of $537.50");
    expect(body(insights, "portfolio-pnl")).toContain("28.7%");
  });

  it("states partial coverage and missing FX without treating weights as whole-portfolio shares", () => {
    const holdings = [holding("TCS.NS"), holding("AAPL", { exchange: "NASDAQ" }), holding("MISSING.NS")];
    const quotes = [quote("TCS.NS", { price: 120 }), quote("AAPL", { price: 200 })];
    const summary = summarisePortfolio(holdings, new Map(quotes.map((value) => [value.symbol, value])), null, "INR");
    const insights = buildPortfolioStories({ summary, quotes });
    expect(body(insights, "portfolio-coverage")).toContain("1 of 3");
    expect(body(insights, "portfolio-coverage")).toContain("1 lack a usable quote; 1 lack a usable currency conversion");
    expect(body(insights, "portfolio-pnl")).toContain("gain of ₹200.00");
    expect(body(insights, "portfolio-concentration")).toContain("100.0% of the priced, convertible book");
    expect(insights.methodology.join(" ")).toContain("does not establish concentration across the whole portfolio");
    expect(insights.methodology.join(" ")).not.toContain("per USD");
  });

  it("does not report zero value or profit when no holding can be valued", () => {
    const summary = summarisePortfolio([holding("NO_QUOTE")], new Map(), null, "INR");
    const insights = buildPortfolioStories({ summary, quotes: [] });
    expect(body(insights, "portfolio-coverage")).toContain("0 of 1");
    expect(body(insights, "portfolio-unavailable")).toContain("does not support an aggregate value");
    expect(insights.stories.some((story) => story.id === "portfolio-pnl")).toBe(false);
    expect(JSON.stringify(insights)).not.toContain("₹0.00");
  });

  it("does not turn an invalid FX-derived summary into measured totals", () => {
    const quotes = [quote("AAPL", { price: 120 })];
    const summary = summarisePortfolio([holding("AAPL", { exchange: "NASDAQ" })], new Map(quotes.map((value) => [value.symbol, value])), Infinity, "INR");
    const insights = buildPortfolioStories({ summary, quotes });
    expect(body(insights, "portfolio-unavailable")).toContain("does not support an aggregate value");
    expect(JSON.stringify(insights)).not.toContain("Infinity");
    expect(JSON.stringify(insights)).not.toContain("NaN");
  });

  it("explains invalid records and unrepresentable values in partial coverage", () => {
    const quotes = [quote("INVALID_INPUT"), quote("OVERFLOW"), quote("VALID")];
    const summary = summarisePortfolio([
      holding("INVALID_INPUT", { quantity: NaN }),
      holding("OVERFLOW", { quantity: 1e308, avg_buy_price: 1 }),
      holding("VALID"),
    ], new Map(quotes.map((value) => [value.symbol, value])), null, "INR");
    const insights = buildPortfolioStories({ summary, quotes });
    expect(body(insights, "portfolio-coverage")).toContain("1 of 3 holdings");
    expect(body(insights, "portfolio-coverage")).toContain("1 have invalid holding inputs");
    expect(body(insights, "portfolio-coverage")).toContain("1 cannot be valued safely");
    expect(body(insights, "portfolio-pnl")).toContain("₹1,000.00");
    expect(insights.methodology.join(" ")).toContain("invalid holding inputs");
    expect(JSON.stringify(insights)).not.toContain("Infinity");
    expect(JSON.stringify(insights)).not.toContain("NaN");
  });

  it("reports a loss with an absolute amount and without inventing a percentage for zero cost", () => {
    const lossQuotes = [quote("LOSS", { price: 80 })];
    const loss = summarisePortfolio([holding("LOSS")], new Map(lossQuotes.map((value) => [value.symbol, value])), null, "INR");
    expect(body(buildPortfolioStories({ summary: loss, quotes: lossQuotes }), "portfolio-pnl")).toContain("loss of ₹200.00");
    expect(body(buildPortfolioStories({ summary: loss, quotes: lossQuotes }), "portfolio-pnl")).toContain("20.0%");

    const free = summarisePortfolio([holding("LOSS", { avg_buy_price: 0 })], new Map(lossQuotes.map((value) => [value.symbol, value])), null, "INR");
    const freeInsights = buildPortfolioStories({ summary: free, quotes: lossQuotes });
    expect(body(freeInsights, "portfolio-pnl")).toContain("gain of ₹800.00");
    expect(body(freeInsights, "portfolio-pnl")).toContain("cost basis is zero");
    expect(body(freeInsights, "portfolio-pnl")).not.toContain("0.0%");
  });

  it("keeps unclassified exposure visible rather than claiming a known sector", () => {
    const quotes = [quote("UNCLASSIFIED")];
    const summary = summarisePortfolio([holding("UNCLASSIFIED", { sector: null })], new Map(quotes.map((value) => [value.symbol, value])), null, "INR");
    expect(body(buildPortfolioStories({ summary, quotes }), "portfolio-concentration")).toContain("Holdings without a sector label represent 100.0%");
  });

  it("limits provenance to portfolio quotes and any rate actually used", () => {
    const quotes = [quote("TCS.NS"), quote("UNRELATED", { provider: "twelve-data", sessionDate: "2020-01-01" }),
      quote("USDINR=X", { provider: "twelve-data", sessionDate: "2020-01-01" })];
    const summary = summarisePortfolio([holding("TCS.NS")], new Map(quotes.map((value) => [value.symbol, value])), 80, "INR");
    const insights = buildPortfolioStories({ summary, quotes });
    expect(insights.sourceNote).toContain("Sources: Yahoo Finance");
    expect(insights.sourceNote).not.toContain("Twelve Data");
    expect(insights.sourceNote).not.toContain("2020-01-01");
  });

  it("shows a useful empty state without creating a synthetic portfolio", () => {
    const insights = buildPortfolioStories({ summary: summarisePortfolio([], new Map(), null, "INR"), quotes: [quote("UNRELATED")] });
    expect(insights.stories).toHaveLength(1);
    expect(insights.stories[0].title).toBe("No holdings yet");
    expect(insights.sourceNote).toBe("Provider times and exchange session dates are unavailable.");
    expect(JSON.stringify(insights)).not.toContain("₹");
  });
});
