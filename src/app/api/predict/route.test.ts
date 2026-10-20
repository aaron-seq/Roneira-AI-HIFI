import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { inserted, insert, getUser, createAdminClient } = vi.hoisted(() => {
  const inserted: Array<{ table: string; row: Record<string, unknown>; privileged: boolean }> = [];
  const insert = (table: string, row: Record<string, unknown>, privileged = false) => {
    inserted.push({ table, row, privileged });
    return Promise.resolve({ error: null });
  };
  return { inserted, insert, createAdminClient: vi.fn(), getUser: vi.fn(async () => ({ data: { user: { id: "test-user" } as { id: string } | null }, error: null as Error | null })) };
});

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser },
  from: (table: string) => ({ insert: (row: Record<string, unknown>) => insert(table, row) }),
}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/server/rate-limit", () => ({ rateLimit: async () => ({ ok: true }), tooManyRequests: vi.fn() }));

const prediction = {
  ticker: "TCS.NS", timeframe: "1month", model_used: "LSTM", current_price: 3500,
  predicted_price: 3500, confidence: 0, price_target_low: 3500, price_target_high: 3500,
  short_term_signal: { signal: "HOLD", score: 5 }, fallback: true,
  fallback_reason: "artifact_unavailable", excluded_components: [],
};

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); inserted.length = 0; getUser.mockClear(); createAdminClient.mockReset(); });

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
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("fails closed on a rejected session even if the response contains a user", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    getUser.mockResolvedValueOnce({ data: { user: { id: "test-user" } }, error: new Error("Rejected session") });
    const response = await POST(new Request("http://localhost/api/predict", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an unimplemented legacy model without contacting the private service", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await POST(new Request("http://localhost/api/predict", {
      method: "POST", body: JSON.stringify({ ticker: "TCS.NS", timeframe: "1month", model_type: "FUNDAMENTAL" }),
    }));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns and audits a fallback without recording it as a successful forecast", async () => {
    createAdminClient.mockReturnValue({ from: (table: string) => ({ insert: (row: Record<string, unknown>) => insert(table, row, true) }) });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(prediction))));
    const response = await POST(new Request("http://localhost/api/predict", {
      method: "POST", body: JSON.stringify({ ticker: "TCS.NS", timeframe: "1month", model_type: "LSTM" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(prediction);
    expect(inserted.map(({ table }) => table)).toEqual(["audit_log"]);
    expect(inserted[0].privileged).toBe(true);
    expect(inserted[0].row.user_id).toBe("test-user");
    expect(inserted[0].row.new_values).toMatchObject({ fallback: true, fallback_reason: "artifact_unavailable" });
  });

  it("preserves the complete payload for an eligible forecast", async () => {
    createAdminClient.mockReturnValue({ from: (table: string) => ({ insert: (row: Record<string, unknown>) => insert(table, row, true) }) });
    const eligible = { ...prediction, fallback: false, fallback_reason: null,
      horizon_sessions: 30, history_sessions: 504, data_session_date: "2026-10-09" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(eligible))));
    await POST(new Request("http://localhost/api/predict", {
      method: "POST", body: JSON.stringify({ ticker: "TCS.NS", timeframe: "1month", model_type: "LSTM" }),
    }));
    expect(inserted.map(({ table }) => table)).toEqual(["predictions_cache", "prediction_history", "audit_log"]);
    expect(inserted.find(({ table }) => table === "prediction_history")?.row.prediction_payload).toEqual(eligible);
    expect(inserted.filter(({ privileged }) => privileged).map(({ table }) => table)).toEqual(["audit_log"]);
  });

  it("retains user-scoped persistence when the privileged audit client is unavailable", async () => {
    createAdminClient.mockImplementation(() => { throw new Error("Admin client unavailable"); });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const eligible = { ...prediction, fallback: false };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(eligible))));
    const response = await POST(new Request("http://localhost/api/predict", {
      method: "POST", body: JSON.stringify({ ticker: "TCS.NS", timeframe: "1month" }),
    }));
    expect(response.status).toBe(200);
    expect(inserted.map(({ table }) => table)).toEqual(["predictions_cache", "prediction_history"]);
    expect(inserted.every(({ privileged }) => !privileged)).toBe(true);
    expect(warning).toHaveBeenCalledWith("Prediction persistence write failed");
  });
});
