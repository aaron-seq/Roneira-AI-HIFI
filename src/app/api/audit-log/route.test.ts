import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createAdminClient: vi.fn(),
  adminFrom: vi.fn(),
  insert: vi.fn(),
  userFrom: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mocks.getUser }, from: mocks.userFrom,
}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/server/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  tooManyRequests: () => new Response(null, { status: 429 }),
}));

const event = { action_type: "SETTINGS_CHANGE", entity_type: "settings", new_values: { theme: "dark" } };
const request = (body: unknown = event) => new Request("http://localhost/api/audit-log", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue({ ok: true });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
  mocks.createAdminClient.mockReturnValue({ from: mocks.adminFrom });
  mocks.adminFrom.mockReturnValue({ insert: mocks.insert });
  mocks.insert.mockResolvedValue({ error: null });
});
afterEach(() => { vi.restoreAllMocks(); });

describe("Authenticated audit write boundary", () => {
  it("derives the actor from getUser and writes only through the trusted backend", async () => {
    const response = await POST(request({ ...event, user_id: "forged-user" }));
    expect(response.status).toBe(200);
    expect(mocks.adminFrom).toHaveBeenCalledWith("audit_log");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "verified-user", action_type: "SETTINGS_CHANGE", new_values: { theme: "dark" },
    }));
    expect(mocks.userFrom).not.toHaveBeenCalled();
  });

  it("rejects anonymous callers before creating a privileged client", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a rejected session even when it contains a user object", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "rejected-user" } }, error: new Error("Rejected") });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown action", { ...event, action_type: "DROP_TABLES" }],
    ["unknown entity", { ...event, entity_type: "users" }],
    ["oversized payload", { ...event, new_values: { oversized: "x".repeat(16_385) } }],
  ])("keeps validation ahead of privileged persistence: %s", async (_label, body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("enforces throttling before authentication or privileged persistence", async () => {
    mocks.rateLimit.mockResolvedValue({ ok: false });
    expect((await POST(request())).status).toBe(429);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("reports a failed privileged write without reporting success", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.insert.mockResolvedValue({ error: new Error("Unavailable") });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to write audit log" });
  });
});
