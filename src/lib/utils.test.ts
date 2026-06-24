import { describe, it, expect, vi } from "vitest";
import {
  cn,
  formatCurrency,
  formatPercent,
  formatCompact,
  formatPrice,
  getPriceColor,
  getPriceBgColor,
  getSignalBadgeClass,
  isIndianTicker,
  getTickerCurrency,
  debounce,
  getConfidenceColor,
  getLetterAvatar,
} from "./utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge tailwind classes correctly", () => {
      expect(cn("bg-red-500", "text-white")).toBe("bg-red-500 text-white");
      expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
      expect(cn("p-4", { "m-4": true, "m-2": false })).toBe("p-4 m-4");
    });
  });

  describe("formatCurrency", () => {
    it("should format USD correctly", () => {
      // Different Node versions handle currency formatting spaces differently
      // Let's use string containing to make it more robust
      const usdStr = formatCurrency(1234.56, "USD");
      expect(usdStr).toContain("1,234.56");
      expect(usdStr).toContain("$");
    });

    it("should format INR correctly", () => {
      const inrStr = formatCurrency(1234.56, "INR");
      expect(inrStr).toContain("1,234.56");
      expect(inrStr).toContain("₹");
    });
  });

  describe("formatPercent", () => {
    it("should format positive percentages", () => {
      expect(formatPercent(12.345)).toBe("+12.35%");
      expect(formatPercent(0)).toBe("+0.00%");
    });

    it("should format negative percentages", () => {
      expect(formatPercent(-12.345)).toBe("-12.35%");
    });

    it("should allow custom decimal places", () => {
      expect(formatPercent(12.345, 1)).toBe("+12.3%");
      expect(formatPercent(12.345, 0)).toBe("+12%");
    });
  });

  describe("formatCompact", () => {
    it("should format trillions", () => {
      expect(formatCompact(1.5e12)).toBe("1.50T");
      expect(formatCompact(-1.5e12)).toBe("-1.50T");
    });

    it("should format billions", () => {
      expect(formatCompact(1.5e9)).toBe("1.50B");
      expect(formatCompact(-1.5e9)).toBe("-1.50B");
    });

    it("should format millions", () => {
      expect(formatCompact(1.5e6)).toBe("1.50M");
      expect(formatCompact(-1.5e6)).toBe("-1.50M");
    });

    it("should format thousands", () => {
      expect(formatCompact(1500)).toBe("1.50K");
      expect(formatCompact(-1500)).toBe("-1.50K");
    });

    it("should format values under 1000", () => {
      expect(formatCompact(999)).toBe("999.00");
      expect(formatCompact(-999)).toBe("-999.00");
    });
  });

  describe("formatPrice", () => {
    it("should format tabular price with 2 decimals", () => {
      expect(formatPrice(1234.567)).toBe("1,234.57");
      expect(formatPrice(1234)).toBe("1,234.00");
    });
  });

  describe("getPriceColor", () => {
    it("should return profit color for positive values", () => {
      expect(getPriceColor(10)).toBe("text-profit");
    });

    it("should return loss color for negative values", () => {
      expect(getPriceColor(-10)).toBe("text-loss");
    });

    it("should return muted color for zero", () => {
      expect(getPriceColor(0)).toBe("text-[var(--color-text-muted)]");
    });
  });

  describe("getPriceBgColor", () => {
    it("should return profit background for positive values", () => {
      expect(getPriceBgColor(10)).toBe("bg-profit-subtle");
    });

    it("should return loss background for negative values", () => {
      expect(getPriceBgColor(-10)).toBe("bg-loss-subtle");
    });

    it("should return empty string for zero", () => {
      expect(getPriceBgColor(0)).toBe("");
    });
  });

  describe("getSignalBadgeClass", () => {
    it("should map signals correctly", () => {
      expect(getSignalBadgeClass("STRONG_BUY")).toBe("badge-strong-buy");
      expect(getSignalBadgeClass("BUY")).toBe("badge-buy");
      expect(getSignalBadgeClass("HOLD")).toBe("badge-hold");
      expect(getSignalBadgeClass("SELL")).toBe("badge-sell");
      expect(getSignalBadgeClass("STRONG_SELL")).toBe("badge-strong-sell");
    });

    it("should fallback to hold for unknown signals", () => {
      // @ts-expect-error testing invalid input
      expect(getSignalBadgeClass("UNKNOWN")).toBe("badge-hold");
    });
  });

  describe("isIndianTicker", () => {
    it("should identify .NS and .BO suffixes", () => {
      expect(isIndianTicker("RELIANCE.NS")).toBe(true);
      expect(isIndianTicker("TCS.BO")).toBe(true);
    });

    it("should reject others", () => {
      expect(isIndianTicker("AAPL")).toBe(false);
      expect(isIndianTicker("TSLA.O")).toBe(false);
    });
  });

  describe("getTickerCurrency", () => {
    it("should return INR for Indian tickers", () => {
      expect(getTickerCurrency("RELIANCE.NS")).toBe("INR");
    });

    it("should return USD for other tickers", () => {
      expect(getTickerCurrency("AAPL")).toBe("USD");
    });
  });

  describe("debounce", () => {
    it("should delay function execution", () => {
      vi.useFakeTimers();
      const func = vi.fn();
      const debouncedFunc = debounce(func, 100);

      debouncedFunc();
      expect(func).not.toBeCalled();

      vi.advanceTimersByTime(50);
      expect(func).not.toBeCalled();

      vi.advanceTimersByTime(50);
      expect(func).toBeCalledTimes(1);

      vi.useRealTimers();
    });

    it("should clear previous timeouts", () => {
      vi.useFakeTimers();
      const func = vi.fn();
      const debouncedFunc = debounce(func, 100);

      debouncedFunc();
      debouncedFunc();
      debouncedFunc();

      vi.advanceTimersByTime(100);
      expect(func).toBeCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("getConfidenceColor", () => {
    it("should return correct colors for score ranges", () => {
      expect(getConfidenceColor(85)).toBe("#2ECC71"); // >= 80
      expect(getConfidenceColor(80)).toBe("#2ECC71");

      expect(getConfidenceColor(75)).toBe("#F39C12"); // >= 60
      expect(getConfidenceColor(60)).toBe("#F39C12");

      expect(getConfidenceColor(50)).toBe("#E67E22"); // >= 40
      expect(getConfidenceColor(40)).toBe("#E67E22");

      expect(getConfidenceColor(30)).toBe("#E74C3C"); // < 40
      expect(getConfidenceColor(0)).toBe("#E74C3C");
    });
  });

  describe("getLetterAvatar", () => {
    it("should return up to 2 uppercase letters from first letters of words", () => {
      expect(getLetterAvatar("Apple Inc")).toBe("AI");
      expect(getLetterAvatar("International Business Machines")).toBe("IB");
      expect(getLetterAvatar("Google")).toBe("G");
      expect(getLetterAvatar("tata motors")).toBe("TM");
    });
  });
});
