import { createAdminClient } from "./admin";

describe("Supabase privileged client configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["", "fixture-service-key"],
    ["http://127.0.0.1:54321", ""],
    ["", ""],
  ])("fails closed with a missing URL or service credential", (url, key) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", key);

    expect(() => createAdminClient()).toThrow("Supabase admin client environment variables are missing.");
  });

  it("does not turn a service credential into a signed-in user session", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-key");

    const client = createAdminClient();
    const { data, error } = await client.auth.getSession();
    expect(error).toBeNull();
    expect(data.session).toBeNull();
  });
});
