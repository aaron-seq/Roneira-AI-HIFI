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
    it("merges tailwind classes", () => {
      expect(cn("bg-red-500", "text-white")).toBe("bg-red-500 text-white");
    });
    it("resolves conflicts", () => {
      expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
    });
    it("handles conditional classes", () => {
      expect(cn("px-2", true && "py-2", false && "mx-2")).toBe("px-2 py-2");
    });
  });

  describe("formatCurrency", () => {
    it("formats USD correctly", () => {
      expect(formatCurrency(1234.56)).toBe("$1,234.56");
      expect(formatCurrency(1234.56, "USD")).toBe("$1,234.56");
    });
    it("formats INR correctly", () => {
      expect(formatCurrency(123456.78, "INR")).toBe("₹1,23,456.78");
    });
  });

  describe("formatPercent", () => {
    it("adds plus sign for positive numbers", () => {
      expect(formatPercent(5.67)).toBe("+5.67%");
      expect(formatPercent(0)).toBe("+0.00%");
    });
    it("keeps minus sign for negative numbers", () => {
      expect(formatPercent(-5.67)).toBe("-5.67%");
    });
    it("respects decimal parameter", () => {
      expect(formatPercent(5.6789, 3)).toBe("+5.679%");
      expect(formatPercent(-5.6789, 1)).toBe("-5.7%");
    });
  });

  describe("formatCompact", () => {
    it("formats trillions", () => {
      expect(formatCompact(1500000000000)).toBe("1.50T");
    });
    it("formats billions", () => {
      expect(formatCompact(1500000000)).toBe("1.50B");
    });
    it("formats millions", () => {
      expect(formatCompact(1500000)).toBe("1.50M");
    });
    it("formats thousands", () => {
      expect(formatCompact(1500)).toBe("1.50K");
    });
    it("leaves small numbers alone", () => {
      expect(formatCompact(150)).toBe("150.00");
    });
    it("handles negative numbers", () => {
      expect(formatCompact(-1500000)).toBe("-1.50M");
    });
    it("rounds numbers near threshold correctly based on boundaries", () => {
      expect(formatCompact(999999)).toBe("1000.00K");
    });
  });

  describe("formatPrice", () => {
    it("formats standard numbers with 2 decimals", () => {
      expect(formatPrice(1234.567)).toBe("1,234.57");
      expect(formatPrice(1234)).toBe("1,234.00");
    });
  });

  describe("getPriceColor", () => {
    it("returns profit class for positive numbers", () => {
      expect(getPriceColor(5)).toBe("text-profit");
    });
    it("returns loss class for negative numbers", () => {
      expect(getPriceColor(-5)).toBe("text-loss");
    });
    it("returns muted class for zero", () => {
      expect(getPriceColor(0)).toBe("text-[var(--color-text-muted)]");
    });
  });

  describe("getPriceBgColor", () => {
    it("returns profit bg for positive numbers", () => {
      expect(getPriceBgColor(5)).toBe("bg-profit-subtle");
    });
    it("returns loss bg for negative numbers", () => {
      expect(getPriceBgColor(-5)).toBe("bg-loss-subtle");
    });
    it("returns empty string for zero", () => {
      expect(getPriceBgColor(0)).toBe("");
    });
  });

  describe("getSignalBadgeClass", () => {
    it("returns correct class for each signal", () => {
      expect(getSignalBadgeClass("STRONG_BUY")).toBe("badge-strong-buy");
      expect(getSignalBadgeClass("BUY")).toBe("badge-buy");
      expect(getSignalBadgeClass("HOLD")).toBe("badge-hold");
      expect(getSignalBadgeClass("SELL")).toBe("badge-sell");
      expect(getSignalBadgeClass("STRONG_SELL")).toBe("badge-strong-sell");
    });
    it("falls back to hold for unknown values", () => {
      // @ts-expect-error testing invalid input
      expect(getSignalBadgeClass("UNKNOWN")).toBe("badge-hold");
    });
  });

  describe("isIndianTicker", () => {
    it("returns true for NSE and BSE tickers", () => {
      expect(isIndianTicker("RELIANCE.NS")).toBe(true);
      expect(isIndianTicker("TCS.BO")).toBe(true);
    });
    it("returns false for other tickers", () => {
      expect(isIndianTicker("AAPL")).toBe(false);
      expect(isIndianTicker("MSFT.O")).toBe(false);
    });
  });

  describe("getTickerCurrency", () => {
    it("returns INR for Indian tickers", () => {
      expect(getTickerCurrency("RELIANCE.NS")).toBe("INR");
    });
    it("returns USD for other tickers", () => {
      expect(getTickerCurrency("AAPL")).toBe("USD");
    });
  });

  describe("debounce", () => {
    it("debounces function calls", () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      const debounced = debounce(callback, 100);

      debounced();
      debounced();
      debounced();

      expect(callback).not.toBeCalled();

      vi.advanceTimersByTime(50);
      expect(callback).not.toBeCalled();

      vi.advanceTimersByTime(50);
      expect(callback).toBeCalledTimes(1);

      vi.useRealTimers();
    });

    it("passes arguments correctly", () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      const debounced = debounce(callback, 100);

      debounced("arg1", "arg2");
      vi.advanceTimersByTime(100);

      expect(callback).toBeCalledWith("arg1", "arg2");

      vi.useRealTimers();
    });
  });

  describe("getConfidenceColor", () => {
    it("returns green for 80+", () => {
      expect(getConfidenceColor(80)).toBe("#2ECC71");
      expect(getConfidenceColor(100)).toBe("#2ECC71");
    });
    it("returns amber for 60-79", () => {
      expect(getConfidenceColor(60)).toBe("#F39C12");
      expect(getConfidenceColor(79)).toBe("#F39C12");
    });
    it("returns orange for 40-59", () => {
      expect(getConfidenceColor(40)).toBe("#E67E22");
      expect(getConfidenceColor(59)).toBe("#E67E22");
    });
    it("returns red for <40", () => {
      expect(getConfidenceColor(39)).toBe("#E74C3C");
      expect(getConfidenceColor(0)).toBe("#E74C3C");
    });
  });

  describe("getLetterAvatar", () => {
    it("generates 2 letter avatar from multi-word string", () => {
      expect(getLetterAvatar("Apple Inc")).toBe("AI");
      expect(getLetterAvatar("Reliance Industries Limited")).toBe("RI");
    });
    it("generates 1 letter avatar from single-word string", () => {
      expect(getLetterAvatar("Tesla")).toBe("T");
    });
    it("always returns uppercase", () => {
      expect(getLetterAvatar("microsoft corp")).toBe("MC");
    });
  });
});
