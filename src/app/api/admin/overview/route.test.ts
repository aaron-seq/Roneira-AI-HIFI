import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const identity = vi.hoisted(() => ({ user: { id: "admin-test" } as { id: string } | null, role: "admin" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: identity.user } }) },
  from: () => ({
    select() { return this; }, eq() { return this; },
    single: async () => ({ data: { role: identity.role } }),
    order() { return this; },
    limit: async () => ({ data: [] }),
    then(resolve: (value: { count: number }) => void) { resolve({ count: 7 }); },
  }),
}) }));

beforeEach(() => {
  identity.user = { id: "admin-test" }; identity.role = "admin";
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ML_BACKEND_URL", "https://ml.example.test");
  vi.stubEnv("ML_SERVICE_TOKEN", "");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("admin health probe", () => {
  it.each(["anonymous", "ordinary"])("checks %s identity before probing", async (actor) => {
    if (actor === "anonymous") identity.user = null;
    else identity.role = "user";
    vi.stubEnv("ML_BACKEND_URL", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await GET()).status).toBe(actor === "anonymous" ? 401 : 403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not require or send the token on public health", async () => {
    const health = { status: "healthy", uptime: 12, models_loaded: { random_forest: true } };
    const fetch = vi.fn(async () => Response.json(health));
    vi.stubGlobal("fetch", fetch);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).mlHealth).toEqual(health);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ml.example.test/health");
    expect(new Headers(init.headers).has("x-ml-service-token")).toBe(false);
    expect(timeout).toHaveBeenCalledWith(5_000);
  });

  it.each(["configuration", "upstream"])("retains the database overview after a %s failure", async (failure) => {
    if (failure === "configuration") vi.stubEnv("ML_BACKEND_URL", "");
    const fetch = vi.fn(async () => Response.json({}, { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ predictionCount: 7, recentUsers: [], recentAudit: [], mlHealth: null });
    if (failure === "configuration") expect(fetch).not.toHaveBeenCalled();
  });
});
