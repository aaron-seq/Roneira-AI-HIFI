// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PredictionResult } from "@/lib/market/types";
import { AnalysisMethod } from "./AnalysisMethod";

afterEach(cleanup);

const baseResult: PredictionResult = {
  ticker: "TCS.NS", company_name: "TCS", exchange: "NSE", current_price: 100,
  predicted_price: 100, price_change: 0, price_change_percent: 0, confidence: 0,
  confidence_breakdown: {}, short_term_signal: { signal: "HOLD", score: 5 },
  long_term_signal: { signal: "HOLD", score: 5 }, indicators: [],
  price_target_low: 100, price_target_high: 100, model_used: "ENSEMBLE",
  timeframe: "1month", computation_time_ms: 10,
};

describe("Historical input and model provenance", () => {
  it("keeps missing provenance unavailable for an older response", () => {
    render(<AnalysisMethod result={baseResult} />);
    const panel = screen.getByRole("region", { name: "Analysis method" });
    expect(panel.textContent).toContain("Provider daily session: Not provided");
    expect(panel.textContent).toContain("not a live quote or forecast date");
    expect(panel.textContent).toContain("fallback status cannot be confirmed");
    expect(panel.textContent).not.toContain("30 trading sessions");
    expect(panel.textContent).not.toContain("2026");
  });

  it("identifies the actual backend and keeps an unknown exclusion reason generic", () => {
    render(<AnalysisMethod result={{
      ...baseResult,
      horizon_sessions: 7, history_sessions: 630, data_session_date: "2026-10-09", data_session_timezone: "Asia/Kolkata",
      model_status: { backend: "xgboost", requested_horizon_sessions: 7, trained_horizon_sessions: 7, fallback: false, fallback_reason: null },
      excluded_components: [{ name: "LSTM", reason: "internal_exception_detail", trained_horizon_sessions: null }],
    }} />);
    const panel = screen.getByRole("region", { name: "Analysis method" });
    expect(panel.textContent).toContain("Gradient-boosted trees (XGBoost)");
    expect(panel.textContent).toContain("630 trading sessions");
    expect(panel.textContent).toContain("2026-10-09 (Asia/Kolkata)");
    expect(panel.textContent).toContain("Sequence artifact: Model unavailable");
    expect(panel.textContent).not.toContain("internal_exception_detail");
  });

  it("distinguishes a rule-based method from missing artifact metadata", () => {
    render(<AnalysisMethod result={{
      ...baseResult,
      model_status: { backend: "technical", requested_horizon_sessions: 7, trained_horizon_sessions: null, fallback: false, fallback_reason: null },
    }} />);
    expect(screen.getByRole("region", { name: "Analysis method" }).textContent).toContain("Not applicable (rules)");
  });

  it("does not point to included models when every ensemble member was excluded", () => {
    render(<AnalysisMethod result={{
      ...baseResult,
      fallback: true, components: [],
      model_status: { backend: "ensemble", requested_horizon_sessions: 30, trained_horizon_sessions: null, fallback: true, fallback_reason: "no_eligible_models" },
      excluded_components: [{ name: "LSTM", reason: "horizon_mismatch", trained_horizon_sessions: 7 }],
    }} />);
    const panel = screen.getByRole("region", { name: "Analysis method" });
    expect(panel.textContent).toContain("See excluded models");
    expect(panel.textContent).toContain("No supported blend was produced");
    expect(panel.textContent).not.toContain("See included models");
  });
});
