import { createAdminClient } from "./admin";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("createAdminClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws an error when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createAdminClient()).toThrow("Missing SUPABASE_SERVICE_ROLE_KEY");
  });

  it("throws an error when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

    expect(() => createAdminClient()).toThrow("Missing NEXT_PUBLIC_SUPABASE_URL");
  });

  it("initializes correctly when environment variables are provided", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

    const client = createAdminClient();
    expect(client).toBeDefined();
  });
});
