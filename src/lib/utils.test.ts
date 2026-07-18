import { describe, it, expect } from "vitest";
import { getPriceColor } from "./utils";

describe("getPriceColor", () => {
  it("returns correct color for positive values", () => {
    const color = getPriceColor(100);
    expect(color === "text-profit" || color === "text-green-500").toBe(true);
    const color2 = getPriceColor(0.01);
    expect(color2 === "text-profit" || color2 === "text-green-500").toBe(true);
  });

  it("returns correct color for negative values", () => {
    const color = getPriceColor(-100);
    expect(color === "text-loss" || color === "text-red-500").toBe(true);
    const color2 = getPriceColor(-0.01);
    expect(color2 === "text-loss" || color2 === "text-red-500").toBe(true);
  });

  it("returns correct color for exactly zero", () => {
    const color = getPriceColor(0);
    expect(color === "text-[var(--color-text-muted)]" || color === "text-muted-foreground").toBe(true);
    const color2 = getPriceColor(-0);
    expect(color2 === "text-[var(--color-text-muted)]" || color2 === "text-muted-foreground").toBe(true);
  });
});
