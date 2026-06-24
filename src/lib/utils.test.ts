import { describe, it, expect } from "vitest";
import { formatCurrency } from "./utils";

describe("formatCurrency", () => {
  describe("USD formatting", () => {
    it("formats positive numbers correctly", () => {
      expect(formatCurrency(100)).toBe("$100.00");
      expect(formatCurrency(100000)).toBe("$100,000.00");
      expect(formatCurrency(1234567.89)).toBe("$1,234,567.89");
    });

    it("formats negative numbers correctly", () => {
      expect(formatCurrency(-100)).toBe("-$100.00");
      expect(formatCurrency(-123.45)).toBe("-$123.45");
    });

    it("formats zero correctly", () => {
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("handles decimal rounding correctly", () => {
      expect(formatCurrency(123.456)).toBe("$123.46");
      expect(formatCurrency(123.454)).toBe("$123.45");
    });

    it("uses USD as the default currency", () => {
      expect(formatCurrency(100)).toBe("$100.00");
    });
  });

  describe("INR formatting", () => {
    it("formats positive numbers correctly with Indian numbering system", () => {
      expect(formatCurrency(100, "INR")).toBe("₹100.00");
      expect(formatCurrency(100000, "INR")).toBe("₹1,00,000.00");
      expect(formatCurrency(1234567.89, "INR")).toBe("₹12,34,567.89");
    });

    it("formats negative numbers correctly", () => {
      expect(formatCurrency(-100, "INR")).toBe("-₹100.00");
      expect(formatCurrency(-123.45, "INR")).toBe("-₹123.45");
    });

    it("formats zero correctly", () => {
      expect(formatCurrency(0, "INR")).toBe("₹0.00");
    });

    it("handles decimal rounding correctly", () => {
      expect(formatCurrency(123.456, "INR")).toBe("₹123.46");
      expect(formatCurrency(123.454, "INR")).toBe("₹123.45");
    });
  });
});
