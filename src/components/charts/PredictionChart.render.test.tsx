// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PredictionChart } from "./PredictionChart";

const chart = vi.hoisted(() => ({
  create: vi.fn(), history: vi.fn(), setData: vi.fn(), createPriceLine: vi.fn(),
  addCandlestickSeries: vi.fn(), addLineSeries: vi.fn(), fitContent: vi.fn(), remove: vi.fn(),
}));
vi.mock("lightweight-charts", () => ({ ColorType: { Solid: "solid" }, LineStyle: { Dashed: 2 }, createChart: chart.create }));
vi.mock("@/lib/hooks/use-live-market", () => ({ useQuoteHistory: chart.history }));

const candles = [
  { time: "2026-10-08T00:00:00Z", open: 100, high: 105, low: 98, close: 102 },
  { time: "2026-10-09T00:00:00Z", open: 102, high: 107, low: 100, close: 104 },
];

beforeEach(() => {
  chart.history.mockReturnValue({ data: { candles }, isLoading: false, isError: false });
  chart.addCandlestickSeries.mockReturnValue({ setData: chart.setData, createPriceLine: chart.createPriceLine });
  chart.create.mockReturnValue({
    addCandlestickSeries: chart.addCandlestickSeries,
    addLineSeries: chart.addLineSeries, timeScale: () => ({ fitContent: chart.fitContent }), remove: chart.remove,
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Prediction chart date and meaning", () => {
  it("keeps all candles historical and draws model estimates as undated price levels", () => {
    const { rerender, unmount } = render(<PredictionChart symbol="TCS.NS" predictedPrice={110} priceTargetLow={90} priceTargetHigh={130} horizonSessions={7} />);
    expect(chart.addLineSeries).not.toHaveBeenCalled();
    expect(chart.setData.mock.calls[0][0]).toEqual(candles.map((candle) => ({
      time: Date.parse(candle.time) / 1000, open: candle.open, high: candle.high, low: candle.low, close: candle.close,
    })));
    expect(chart.createPriceLine.mock.calls.map(([line]) => [line.title, line.price])).toEqual([
      ["Model estimate", 110], ["Lower reference", 90], ["Upper reference", 130],
    ]);
    const scale = chart.addCandlestickSeries.mock.calls[0][0].autoscaleInfoProvider(() => ({ priceRange: { minValue: 98, maxValue: 107 } }));
    expect(scale.priceRange).toEqual({ minValue: 90, maxValue: 130 });
    expect(screen.getByText(/reference levels for 7 trading sessions/).textContent).toContain("not dated future candles or probability bounds");
    expect(screen.getByText(/Price is on the vertical axis/).textContent).toContain("Model estimate 110.00");
    rerender(<PredictionChart symbol="TCS.NS" predictedPrice={110} priceTargetLow={90} priceTargetHigh={130} horizonSessions={90} />);
    expect(screen.getByText(/reference levels for 90 trading sessions/)).toBeTruthy();
    unmount();
    expect(chart.remove).toHaveBeenCalledOnce();
  });
});
