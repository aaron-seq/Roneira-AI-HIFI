import { describe, it, expect } from "vitest";
import { formatCurrency } from "./utils";

describe("formatCurrency", () => {
  it("formats value as USD by default", () => {
    // Some node environments use non-breaking space (char code 160) for formatting, some use standard space
    const formatted = formatCurrency(1234.56);
    // Replace non-breaking space with normal space just to be safe, though modern intl tends to have strict output
    expect(formatted.replace(/\u00A0/g, ' ')).toBe("$1,234.56");
  });

  it("formats value as USD when currency is USD", () => {
    expect(formatCurrency(1234.56, "USD").replace(/\u00A0/g, ' ')).toBe("$1,234.56");
  });

  it("formats value as INR when currency is INR", () => {
    // Depending on environment, INR formatting might put space or no space, or use ₹1,234.56
    // Intl.NumberFormat "en-IN" format for currency gives something like ₹1,234.56
    const formatted = formatCurrency(1234.56, "INR").replace(/\u00A0/g, ' ');
    expect(formatted).toMatch(/₹1,234.56/);
  });

  it("formats zero correctly", () => {
    expect(formatCurrency(0).replace(/\u00A0/g, ' ')).toBe("$0.00");
  });

  it("formats negative numbers correctly", () => {
    expect(formatCurrency(-1234.56).replace(/\u00A0/g, ' ')).toMatch(/-\$1,234\.56/);
  });

  it("rounds decimals to 2 places", () => {
    expect(formatCurrency(1234.567).replace(/\u00A0/g, ' ')).toBe("$1,234.57");
    expect(formatCurrency(1234.564).replace(/\u00A0/g, ' ')).toBe("$1,234.56");
  });
});
