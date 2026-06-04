import { describe, it, expect } from "vitest";
import { getHistoryOutputSize } from "./market";

describe("getHistoryOutputSize", () => {
  it('should return 30 for "1month"', () => {
    expect(getHistoryOutputSize("1month")).toBe(30);
  });

  it('should return 90 for "3month"', () => {
    expect(getHistoryOutputSize("3month")).toBe(90);
  });

  it('should return 180 for "6month"', () => {
    expect(getHistoryOutputSize("6month")).toBe(180);
  });

  it('should return 365 for "1year"', () => {
    expect(getHistoryOutputSize("1year")).toBe(365);
  });

  it("should return 120 for an unknown range (default edge case)", () => {
    expect(getHistoryOutputSize("unknown_range")).toBe(120);
  });

  it("should return 120 for an empty string range (default edge case)", () => {
    expect(getHistoryOutputSize("")).toBe(120);
  });
});
