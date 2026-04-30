import { describe, it, expect } from "vitest";
import { getLetterAvatar, getConfidenceColor } from "./utils";

describe("utils", () => {
  describe("getLetterAvatar", () => {
    it("generates avatar for a single word", () => {
      expect(getLetterAvatar("Apple")).toBe("A");
    });

    it("generates avatar for two words", () => {
      expect(getLetterAvatar("Apple Inc")).toBe("AI");
    });

    it("limits avatar to two characters for many words", () => {
      expect(getLetterAvatar("Apple Inc California USA")).toBe("AI");
    });

    it("converts to uppercase", () => {
      expect(getLetterAvatar("apple inc")).toBe("AI");
    });

    it("handles empty string", () => {
      expect(getLetterAvatar("")).toBe("");
    });

    it("handles string with only spaces", () => {
      expect(getLetterAvatar("   ")).toBe("");
    });

    it("handles leading and trailing spaces", () => {
      expect(getLetterAvatar("  Apple Inc  ")).toBe("AI");
    });

    it("handles multiple internal spaces", () => {
      expect(getLetterAvatar("Apple    Inc")).toBe("AI");
    });

    it("handles special characters", () => {
      expect(getLetterAvatar("$Profit Maker")).toBe("$M");
    });
  });

  describe("getConfidenceColor", () => {
    it("returns emerald green for score >= 80", () => {
      expect(getConfidenceColor(100)).toBe("#2ECC71");
      expect(getConfidenceColor(80)).toBe("#2ECC71");
    });

    it("returns amber for score between 60 and 79", () => {
      expect(getConfidenceColor(79)).toBe("#F39C12");
      expect(getConfidenceColor(60)).toBe("#F39C12");
    });

    it("returns orange for score between 40 and 59", () => {
      expect(getConfidenceColor(59)).toBe("#E67E22");
      expect(getConfidenceColor(40)).toBe("#E67E22");
    });

    it("returns red for score below 40", () => {
      expect(getConfidenceColor(39)).toBe("#E74C3C");
      expect(getConfidenceColor(0)).toBe("#E74C3C");
      expect(getConfidenceColor(-10)).toBe("#E74C3C");
    });
  });
});
