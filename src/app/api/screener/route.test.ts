import { inspect } from "node:util";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const gate = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/lib/server/rate-limit", () => ({
  rateLimit: async () => ({ ok: gate.allowed }),
  tooManyRequests: () => Response.json({ error: "Too many requests" }, { status: 429 }),
}));
const request = () => new Request("https://app.example.test/api/screener");

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ML_BACKEND_URL", "https://ml.example.test");
  vi.stubEnv("ML_SERVICE_TOKEN", "test-service-token");
  gate.allowed = true;
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("screener backend boundary", () => {
  it("reports missing configuration before any fetch", async () => {
    vi.stubEnv("ML_BACKEND_URL", "");
    const fetch = vi.fn(async () => Response.json({ stocks: [] }));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await GET(request())).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves payload, authentication and the90second deadline", async () => {
    const payload = { stocks: [{ ticker: "TCS.NS" }], timestamp: "2026-10-20" };
    const fetch = vi.fn(async () => Response.json(payload));
    vi.stubGlobal("fetch", fetch);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ml.example.test/screener");
    expect(new Headers(init.headers).get("x-ml-service-token")).toBe("test-service-token");
    expect(init.redirect).toBe("error");
    expect(timeout).toHaveBeenCalledWith(90_000);
  });

  it("does not leak a rejected backend's response to clients or logs", async () => {
    const detail = "https://ml.example.test/test-service-token/private-upstream-detail";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ detail }, { status: 503 })));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Market service is temporarily unavailable.", code: "ML_SERVICE_UNAVAILABLE" });
    expect(inspect(log.mock.calls)).not.toContain("test-service-token");
    expect(inspect(log.mock.calls)).not.toContain("private-upstream-detail");
  });

  it("retains the rate gate before ML validation", async () => {
    gate.allowed = false;
    vi.stubEnv("ML_BACKEND_URL", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await GET(request())).status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });
});
