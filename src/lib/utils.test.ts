import { describe, it, expect } from "vitest";
import { formatCompact } from "./utils";

describe("formatCompact", () => {
  it("formats numbers less than 1000 with 2 decimal places", () => {
    expect(formatCompact(0)).toBe("0.00");
    expect(formatCompact(123)).toBe("123.00");
    expect(formatCompact(999.99)).toBe("999.99");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCompact(1000)).toBe("1.00K");
    expect(formatCompact(1500)).toBe("1.50K");
    expect(formatCompact(999999)).toBe("1000.00K");
  });

  it("formats millions with M suffix", () => {
    expect(formatCompact(1000000)).toBe("1.00M");
    expect(formatCompact(1500000)).toBe("1.50M");
    expect(formatCompact(999999999)).toBe("1000.00M");
  });

  it("formats billions with B suffix", () => {
    expect(formatCompact(1000000000)).toBe("1.00B");
    expect(formatCompact(2500000000)).toBe("2.50B");
  });

  it("formats trillions with T suffix", () => {
    expect(formatCompact(1000000000000)).toBe("1.00T");
    expect(formatCompact(5750000000000)).toBe("5.75T");
  });

  it("handles negative numbers correctly", () => {
    expect(formatCompact(-500)).toBe("-500.00");
    expect(formatCompact(-1000)).toBe("-1.00K");
    expect(formatCompact(-1500000)).toBe("-1.50M");
    expect(formatCompact(-2000000000)).toBe("-2.00B");
    expect(formatCompact(-3000000000000)).toBe("-3.00T");
  });

  it("handles rounding boundary values near 1000", () => {
    // Current implementation checks value before rounding
    // Math.abs(999.999) is 999.999 which is < 1000
    // So it returns 999.999.toFixed(2) which is "1000.00"
    expect(formatCompact(999.999)).toBe("1000.00");
  });
});
