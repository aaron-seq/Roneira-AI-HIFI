// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import PredictPage from "./page";
import type { PredictionResult } from "@/lib/market/types";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("ticker=TCS.NS") }));
vi.mock("@/components/charts/PredictionChart", () => ({ PredictionChart: ({ horizonSessions }: { horizonSessions: number }) => <p>History reference levels: {horizonSessions} sessions</p> }));
vi.mock("@/components/prediction/CompetitorTable", () => ({ CompetitorTable: () => null }));

const result: PredictionResult = {
  ticker: "TCS.NS", company_name: "Tata Consultancy Services", exchange: "NSE",
  current_price: 3500, predicted_price: 3600, price_change: 100, price_change_percent: 2.86,
  confidence: 72, confidence_breakdown: {}, short_term_signal: { signal: "BUY", score: 6 },
  long_term_signal: { signal: "BUY", score: 6 }, indicators: [], price_target_low: 3400,
  price_target_high: 3800, model_used: "ENSEMBLE", timeframe: "1month", computation_time_ms: 50,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><PredictPage /></QueryClientProvider>);
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Prediction request and result states", () => {
  it("announces pending work, then shows the actual session unit and heuristic limits", async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetch);
    renderPage();
    expect(screen.getByRole("combobox", { name: "Model horizon" }).textContent).toContain("30 trading sessions");
    fireEvent.click(screen.getByRole("button", { name: "ANALYZE" }));
    await screen.findByText("Analyzing TCS.NS for 30 trading sessions…");
    expect((screen.getByRole("combobox", { name: "Stock" }) as HTMLInputElement).disabled).toBe(true);
    finish(new Response(JSON.stringify(result), { status: 200 }));
    await screen.findByText(/Analysis complete for TCS.NS/);
    expect(screen.getByRole("region", { name: "Heuristic model score" }).textContent).toContain("not the probability");
    expect(screen.getByText("History reference levels: 30 sessions")).toBeTruthy();
    expect(screen.queryByText("Overall Confidence")).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "Model horizon" }), { target: { value: "1week" } });
    expect(screen.getByText(/These results are from your previous analysis/)).toBeTruthy();
    expect(screen.getByText(/Selecting another horizon does not retrain them/)).toBeTruthy();
    expect(screen.getByText("History reference levels: 30 sessions")).toBeTruthy();
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({ ticker: "TCS.NS", timeframe: "1month", model_type: "ENSEMBLE" });
  });

  it("handles failed requests with an accessible retry instead of developer diagnostics", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response("internal backend error", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(result), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "ANALYZE" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("No new estimate is available");
    expect(alert.textContent).not.toContain("ML backend");
    expect(screen.queryByText("Select a stock and click Analyze")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try analysis again" }));
    await waitFor(() => expect(screen.getByText(/Analysis complete for TCS.NS/)).toBeTruthy());
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
