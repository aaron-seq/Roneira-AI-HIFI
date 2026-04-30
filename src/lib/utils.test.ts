import { describe, it, expect } from "vitest";
import { formatCurrency } from "./utils";

describe("formatCurrency", () => {
  describe("USD (default)", () => {
    it("formats positive numbers correctly", () => {
      expect(formatCurrency(1234.56)).toBe("$1,234.56");
    });

    it("formats negative numbers correctly", () => {
      expect(formatCurrency(-1234.56)).toBe("-$1,234.56");
    });

    it("formats zero correctly", () => {
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("rounds numbers with many decimal places", () => {
      expect(formatCurrency(1234.5678)).toBe("$1,234.57");
      expect(formatCurrency(1234.564)).toBe("$1,234.56");
    });

    it("formats large numbers correctly", () => {
      expect(formatCurrency(1234567.89)).toBe("$1,234,567.89");
    });
  });

  describe("INR", () => {
    it("formats positive numbers correctly", () => {
      expect(formatCurrency(1234.56, "INR")).toBe("₹1,234.56");
    });

    it("formats negative numbers correctly", () => {
      expect(formatCurrency(-1234.56, "INR")).toBe("-₹1,234.56");
    });

    it("formats zero correctly", () => {
      expect(formatCurrency(0, "INR")).toBe("₹0.00");
    });

    it("rounds numbers with many decimal places", () => {
      expect(formatCurrency(1234.5678, "INR")).toBe("₹1,234.57");
      expect(formatCurrency(1234.564, "INR")).toBe("₹1,234.56");
    });

    it("formats large numbers using Indian numbering system", () => {
      // 12 lakhs, 34 thousand, 567 rupees and 89 paise
      expect(formatCurrency(1234567.89, "INR")).toBe("₹12,34,567.89");
      // 1 crore
      expect(formatCurrency(10000000, "INR")).toBe("₹1,00,00,000.00");
    });
  });
});
