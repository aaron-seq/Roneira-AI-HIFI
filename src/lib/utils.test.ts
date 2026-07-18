import { describe, it, expect } from "vitest";
import { getPriceColor } from "./utils";

describe("getPriceColor", () => {
  it("returns text-profit for positive numbers", () => {
    expect(getPriceColor(10)).toBe("text-profit");
    expect(getPriceColor(0.01)).toBe("text-profit");
  });

  it("returns text-loss for negative numbers", () => {
    expect(getPriceColor(-10)).toBe("text-loss");
    expect(getPriceColor(-0.01)).toBe("text-loss");
  });

  it("returns muted text color for exactly 0", () => {
    expect(getPriceColor(0)).toBe("text-[var(--color-text-muted)]");
    expect(getPriceColor(-0)).toBe("text-[var(--color-text-muted)]");
  });
});
