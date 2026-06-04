import { describe, it, expect } from "vitest";
import { formatPercent } from "./utils";

describe("formatPercent", () => {
  it("formats positive numbers with default 2 decimals", () => {
    expect(formatPercent(5)).toBe("+5.00%");
    expect(formatPercent(12.34)).toBe("+12.34%");
  });

  it("formats negative numbers with default 2 decimals", () => {
    expect(formatPercent(-5)).toBe("-5.00%");
    expect(formatPercent(-12.34)).toBe("-12.34%");
  });

  it("formats zero correctly", () => {
    expect(formatPercent(0)).toBe("+0.00%");
  });

  it("formats numbers with custom decimals", () => {
    expect(formatPercent(12.3456, 3)).toBe("+12.346%");
    expect(formatPercent(-12.3456, 1)).toBe("-12.3%");
    expect(formatPercent(5, 0)).toBe("+5%");
  });

  it("handles edge case of negative zero", () => {
    expect(formatPercent(-0)).toBe("+0.00%"); // JavaScript -0 >= 0 is true, so it outputs +0.00%
  });
});
