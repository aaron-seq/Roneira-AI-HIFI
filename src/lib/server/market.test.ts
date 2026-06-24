import { describe, it, expect } from "vitest";
import { mapSectionQuotes } from "./market";
import type { QuoteConfig, MarketQuote } from "@/lib/market/types";

describe("mapSectionQuotes", () => {
  it("maps valid quotes and filters out missing ones", () => {
    const section: QuoteConfig[] = [
      { symbol: "AAPL", name: "Apple", exchange: "NASDAQ", assetType: "equity", currency: "USD" },
      { symbol: "MSFT", name: "Microsoft", exchange: "NASDAQ", assetType: "equity", currency: "USD" },
      { symbol: "GOOG", name: "Alphabet", exchange: "NASDAQ", assetType: "equity", currency: "USD" },
    ];

    const aaplQuote: MarketQuote = {
      symbol: "AAPL",
      name: "Apple",
      exchange: "NASDAQ",
      assetType: "equity",
      currency: "USD",
      price: 150,
      change: 1,
      changePercent: 0.5,
      provider: "twelve-data",
      timestamp: "2023-01-01",
    };

    const googQuote: MarketQuote = {
      symbol: "GOOG",
      name: "Alphabet",
      exchange: "NASDAQ",
      assetType: "equity",
      currency: "USD",
      price: 2800,
      change: 10,
      changePercent: 0.3,
      provider: "twelve-data",
      timestamp: "2023-01-01",
    };

    const quotesBySymbol = new Map<string, MarketQuote>([
      ["AAPL", aaplQuote],
      ["GOOG", googQuote],
      // MSFT is missing
    ]);

    const result = mapSectionQuotes(section, quotesBySymbol);

    expect(result).toHaveLength(2);
    expect(result).toEqual([aaplQuote, googQuote]);
  });

  it("returns empty array when section is empty", () => {
    const section: QuoteConfig[] = [];
    const quotesBySymbol = new Map<string, MarketQuote>();
    const result = mapSectionQuotes(section, quotesBySymbol);
    expect(result).toEqual([]);
  });

  it("returns empty array when quotes map is empty", () => {
    const section: QuoteConfig[] = [
      { symbol: "AAPL", name: "Apple", exchange: "NASDAQ", assetType: "equity", currency: "USD" },
    ];
    const quotesBySymbol = new Map<string, MarketQuote>();
    const result = mapSectionQuotes(section, quotesBySymbol);
    expect(result).toEqual([]);
  });
});
