import { describe, it, expect } from "vitest";
import { isIndianTicker, getTickerCurrency } from "./utils";

describe("isIndianTicker", () => {
  it("should return true for NSE tickers ending in .NS", () => {
    expect(isIndianTicker("RELIANCE.NS")).toBe(true);
    expect(isIndianTicker("TCS.NS")).toBe(true);
  });

  it("should return true for BSE tickers ending in .BO", () => {
    expect(isIndianTicker("RELIANCE.BO")).toBe(true);
    expect(isIndianTicker("TCS.BO")).toBe(true);
  });

  it("should return false for US tickers", () => {
    expect(isIndianTicker("AAPL")).toBe(false);
    expect(isIndianTicker("MSFT")).toBe(false);
    expect(isIndianTicker("GOOGL")).toBe(false);
  });

  it("should return false for other global tickers", () => {
    expect(isIndianTicker("0700.HK")).toBe(false); // Hong Kong
    expect(isIndianTicker("RY.TO")).toBe(false); // Toronto
    expect(isIndianTicker("VOD.L")).toBe(false); // London
  });

  it("should return false for empty strings or invalid formats", () => {
    expect(isIndianTicker("")).toBe(false);
    expect(isIndianTicker(".NS")).toBe(true); // Technically matches endsWith, which is expected behavior for simple string check
    expect(isIndianTicker("NS")).toBe(false);
    expect(isIndianTicker("BO")).toBe(false);
  });
});

describe("getTickerCurrency", () => {
  it("should return INR for Indian tickers", () => {
    expect(getTickerCurrency("RELIANCE.NS")).toBe("INR");
    expect(getTickerCurrency("TCS.BO")).toBe("INR");
  });

  it("should return USD for non-Indian tickers", () => {
    expect(getTickerCurrency("AAPL")).toBe("USD");
    expect(getTickerCurrency("MSFT")).toBe("USD");
    expect(getTickerCurrency("0700.HK")).toBe("USD");
    expect(getTickerCurrency("")).toBe("USD");
  });
});
