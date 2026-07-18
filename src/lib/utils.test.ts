import { describe, it, expect } from "vitest";
import { formatCompact, formatPercent } from "./utils";

describe("formatCompact", () => {
  it("formats trillions correctly", () => {
    expect(formatCompact(1500000000000)).toBe("1.50T");
    expect(formatCompact(1234000000000)).toBe("1.23T");
    expect(formatCompact(-2500000000000)).toBe("-2.50T");
  });

  it("formats billions correctly", () => {
    expect(formatCompact(1500000000)).toBe("1.50B");
    expect(formatCompact(1234000000)).toBe("1.23B");
    expect(formatCompact(-2500000000)).toBe("-2.50B");
  });

  it("formats millions correctly", () => {
    expect(formatCompact(1500000)).toBe("1.50M");
    expect(formatCompact(1234000)).toBe("1.23M");
    expect(formatCompact(-2500000)).toBe("-2.50M");
  });

  it("formats thousands correctly", () => {
    expect(formatCompact(1500)).toBe("1.50K");
    expect(formatCompact(1234)).toBe("1.23K");
    expect(formatCompact(-2500)).toBe("-2.50K");
  });

  it("formats values under 1000 correctly", () => {
    expect(formatCompact(999)).toBe("999.00");
    expect(formatCompact(150)).toBe("150.00");
    expect(formatCompact(1.5)).toBe("1.50");
    expect(formatCompact(0)).toBe("0.00");
    expect(formatCompact(-999)).toBe("-999.00");
  });
});

describe("formatPercent", () => {
  it("formats positive percentages with a '+' prefix", () => {
    expect(formatPercent(5)).toBe("+5.00%");
    expect(formatPercent(12.345)).toBe("+12.35%");
  });

  it("formats zero with a '+' prefix", () => {
    expect(formatPercent(0)).toBe("+0.00%");
  });

  it("formats negative percentages without an extra prefix", () => {
    expect(formatPercent(-5)).toBe("-5.00%");
    expect(formatPercent(-12.345)).toBe("-12.35%");
  });

  it("allows custom decimal places", () => {
    expect(formatPercent(5.1234, 1)).toBe("+5.1%");
    expect(formatPercent(-5.1234, 3)).toBe("-5.123%");
    expect(formatPercent(5, 0)).toBe("+5%");
  });
});
