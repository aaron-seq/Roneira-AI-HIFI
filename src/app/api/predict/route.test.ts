import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { inserted, insert, getUser } = vi.hoisted(() => {
  const inserted: Array<{ table: string; row: Record<string, unknown> }> = [];
  const insert = (table: string, row: Record<string, unknown>) => {
    inserted.push({ table, row });
    return Promise.resolve({ error: null });
  };
  return { inserted, insert, getUser: vi.fn(async () => ({ data: { user: { id: "test-user" } as { id: string } | null }, error: null as Error | null })) };
});

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser },
  from: (table: string) => ({ insert: (row: Record<string, unknown>) => insert(table, row) }),
}) }));
vi.mock("@/lib/server/rate-limit", () => ({ rateLimit: async () => ({ ok: true }), tooManyRequests: vi.fn() }));

const prediction = {
  ticker: "TCS.NS", timeframe: "1month", model_used: "LSTM", current_price: 3500,
  predicted_price: 3500, confidence: 0, price_target_low: 3500, price_target_high: 3500,
  short_term_signal: { signal: "HOLD", score: 5 }, fallback: true,
  fallback_reason: "artifact_unavailable", excluded_components: [],
};

afterEach(() => { vi.unstubAllGlobals(); inserted.length = 0; getUser.mockClear(); });

describe("Prediction provenance persistence", () => {
  it("rejects an anonymous request before spending inference or storing results", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const response = await POST(new Request("http://localhost/api/predict", {
      method: "POST", body: JSON.stringify({ ticker: "TCS.NS", timeframe: "1month" }),
    }));
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(inserted).toEqual([]);
  });

  it("fails closed on a rejected session even if the response contains a user", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    getUser.mockResolvedValueOnce({ data: { user: { id: "test-user" } }, error: new Error("Rejected session") });
    const response = await POST(new Request("http://localhost/api/predict", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an unimplemented legacy model without contacting the private service", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await POST(new Request("http://localhost/api/predict", {
      method: "POST", body: JSON.stringify({ ticker: "TCS.NS", timeframe: "1month", model_type: "FUNDAMENTAL" }),
    }));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns and audits a fallback without recording it as a successful forecast", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(prediction))));
    const response = await POST(new Request("http://localhost/api/predict", {
      method: "POST", body: JSON.stringify({ ticker: "TCS.NS", timeframe: "1month", model_type: "LSTM" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(prediction);
    expect(inserted.map(({ table }) => table)).toEqual(["audit_log"]);
    expect(inserted[0].row.new_values).toMatchObject({ fallback: true, fallback_reason: "artifact_unavailable" });
  });

  it("preserves the complete payload for an eligible forecast", async () => {
    const eligible = { ...prediction, fallback: false, fallback_reason: null,
      horizon_sessions: 30, history_sessions: 504, data_session_date: "2026-10-09" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(eligible))));
    await POST(new Request("http://localhost/api/predict", {
      method: "POST", body: JSON.stringify({ ticker: "TCS.NS", timeframe: "1month", model_type: "LSTM" }),
    }));
    expect(inserted.map(({ table }) => table)).toEqual(["predictions_cache", "prediction_history", "audit_log"]);
    expect(inserted.find(({ table }) => table === "prediction_history")?.row.prediction_payload).toEqual(eligible);
  });
});
