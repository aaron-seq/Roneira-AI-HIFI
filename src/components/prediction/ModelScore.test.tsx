// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ModelScore } from "./ModelScore";
import { ModelSpread } from "./ModelSpread";

afterEach(cleanup);

describe("Prediction score meaning", () => {
  it("explains a heuristic score without depicting an accuracy probability", () => {
    render(<ModelScore score={82} />);
    const card = screen.getByRole("region", { name: "Heuristic model score" });
    expect(card.textContent).toContain("82of 100");
    expect(card.textContent).toContain("not the probability");
    expect(card.textContent).toContain("not directly comparable");
    expect(card.querySelector("svg")).toBeNull();
    expect(card.textContent).not.toContain("82%");
  });

  it("separates target proximity from accuracy and discloses a fallback member", () => {
    render(<ModelSpread components={[
      { name: "RANDOM_FOREST", predicted_price: 100, confidence: 30, weight: 0.5, signal: "HOLD", fallback: true },
      { name: "LSTM", predicted_price: 110, confidence: 60, weight: 0.5, signal: "BUY", fallback: false },
    ]} currentPrice={100} blendedPrice={105} agreementScore={0.8} priceSpread={5} />);
    const card = screen.getByRole("region", { name: "Model target spread" });
    expect(card.textContent).toContain("Target proximity");
    expect(card.textContent).toContain("80 of 100");
    expect(card.textContent).toContain("does not measure accuracy");
    expect(card.textContent).toContain("fallback estimate");
    expect(card.textContent).not.toContain("60%");
  });
});
