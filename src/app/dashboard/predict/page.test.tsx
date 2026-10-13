// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// Framer Motion restores scroll positions while measuring layout; jsdom has no
// scrolling implementation. Browser validation covers the actual layout.
beforeEach(() => vi.stubGlobal("scrollTo", vi.fn()));
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
    expect(screen.getByText(/artifacts trained for another horizon are excluded/)).toBeTruthy();
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

  it("describes the selected model and separates excluded models from included estimates", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ...result,
      horizon_sessions: 30, history_sessions: 756, data_session_date: "2026-10-09", data_session_timezone: "Asia/Kolkata",
      model_status: { backend: "ensemble", requested_horizon_sessions: 30, trained_horizon_sessions: null, fallback: false, fallback_reason: null },
      components: [{ name: "TECHNICAL", predicted_price: 3600, confidence: 72, weight: 1, signal: "BUY", fallback: false, backend: "technical", trained_horizon_sessions: null }],
      excluded_components: [{ name: "LSTM", reason: "horizon_mismatch", trained_horizon_sessions: 7 }],
    }), { status: 200 })));
    renderPage();
    const picker = screen.getByRole("combobox", { name: "Model" });
    expect(picker.getAttribute("aria-describedby")).toBe("prediction-model-help");
    expect(screen.getByRole("option", { name: "Equal-weight blend" })).toBeTruthy();
    fireEvent.change(picker, { target: { value: "GAN" } });
    expect(screen.getByText(/Produces one estimate, not a probability distribution/)).toBeTruthy();
    fireEvent.change(picker, { target: { value: "ENSEMBLE" } });
    fireEvent.click(screen.getByRole("button", { name: "ANALYZE" }));
    const method = await screen.findByRole("region", { name: "Analysis method" });
    expect(method.textContent).toContain("756 trading sessions");
    expect(method.textContent).toContain("2026-10-09 (Asia/Kolkata)");
    expect(method.textContent).toContain("Trained for a different horizon (trained for 7 trading sessions)");
    const spread = screen.getByRole("region", { name: "Model target spread" });
    expect(within(spread).getByText("One model contributed")).toBeTruthy();
    expect(spread.textContent).not.toContain("Sequence artifact");
    expect(spread.textContent).not.toContain("The model calls agree");
    expect(spread.textContent).not.toContain("Target proximity");
  });

  it("presents an unsupported artifact as a no-change reference and suppresses forecast visuals", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ...result, model_used: "LSTM", predicted_price: 3500, price_change: 0, price_change_percent: 0,
      fallback: true, fallback_reason: "horizon_mismatch", horizon_sessions: 30,
      model_status: { backend: "xgboost", requested_horizon_sessions: 30, trained_horizon_sessions: 7, fallback: true, fallback_reason: "horizon_mismatch" },
    }), { status: 200 })));
    renderPage();
    fireEvent.change(screen.getByRole("combobox", { name: "Model" }), { target: { value: "LSTM" } });
    fireEvent.click(screen.getByRole("button", { name: "ANALYZE" }));
    await screen.findByText("Fallback reference — no supported forecast");
    expect(screen.getByText(/The reference repeats the latest historical close/)).toBeTruthy();
    expect(screen.getByText(/Analysis unavailable for TCS.NS/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Analysis method" }).textContent).toContain("7 trading sessions");
    expect(screen.queryByRole("region", { name: "Heuristic model score" })).toBeNull();
    expect(screen.queryByText("Signal Analysis")).toBeNull();
    expect(screen.queryByText(/History reference levels/)).toBeNull();
    expect(screen.queryByText("Illustrative Price Levels")).toBeNull();
    expect(screen.queryByText("Model Estimate")).toBeNull();
    expect(screen.queryByText("horizon_mismatch")).toBeNull();
  });
});
