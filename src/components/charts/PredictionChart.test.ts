import { toChartTime } from "@/components/charts/PredictionChart";

describe("PredictionChart helpers", () => {
  it("converts iso timestamps into unix chart time", () => {
    const result = toChartTime("2026-04-04T12:00:00.000Z");
    expect(result).toBe(1775304000);
  });
});
