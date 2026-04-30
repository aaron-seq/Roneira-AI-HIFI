import { describe, it, expect } from "vitest";
import { formatCurrency } from "./utils";

describe("formatCurrency", () => {
  describe("USD formatting (default)", () => {
    it("formats positive numbers correctly", () => {
      expect(formatCurrency(1234.56)).toBe("$1,234.56");
      expect(formatCurrency(100)).toBe("$100.00");
    });

    it("formats negative numbers correctly", () => {
      expect(formatCurrency(-1234.56)).toBe("-$1,234.56");
      expect(formatCurrency(-100)).toBe("-$100.00");
    });

    it("formats zero correctly", () => {
      expect(formatCurrency(0)).toBe("$0.00");
      expect(formatCurrency(-0)).toBe("-$0.00");
    });

    it("handles large numbers with correct grouping", () => {
      expect(formatCurrency(1000000)).toBe("$1,000,000.00");
    });

    it("rounds decimals to two places", () => {
      expect(formatCurrency(1234.567)).toBe("$1,234.57");
      expect(formatCurrency(1234.564)).toBe("$1,234.56");
    });
  });

  describe("INR formatting", () => {
    it("formats positive numbers correctly", () => {
      // NOTE: Intl.NumberFormat might use a specific representation for INR
      // Using standard expected output for en-IN locale
      expect(formatCurrency(1234.56, "INR")).toBe("₹1,234.56");
      expect(formatCurrency(100, "INR")).toBe("₹100.00");
    });

    it("formats negative numbers correctly", () => {
      expect(formatCurrency(-1234.56, "INR")).toBe("-₹1,234.56");
      expect(formatCurrency(-100, "INR")).toBe("-₹100.00");
    });

    it("formats zero correctly", () => {
      expect(formatCurrency(0, "INR")).toBe("₹0.00");
    });

    it("handles large numbers with correct Indian numbering system grouping (lakhs/crores)", () => {
      // 10 lakhs = 1 million
      expect(formatCurrency(1000000, "INR")).toBe("₹10,00,000.00");
      // 1 crore = 10 million
      expect(formatCurrency(10000000, "INR")).toBe("₹1,00,00,000.00");
    });
  });
});
