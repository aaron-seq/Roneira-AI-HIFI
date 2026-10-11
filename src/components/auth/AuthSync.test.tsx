// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_PREFERENCES, useAppStore, type UserProfile } from "@/lib/stores/app-store";
import { AuthSync } from "./AuthSync";

const mock = vi.hoisted(() => ({
  getUser: vi.fn(), maybeSingle: vi.fn(), onAuthStateChange: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  createClient: () => ({
    auth: { getUser: mock.getUser, onAuthStateChange: mock.onAuthStateChange },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mock.maybeSingle }) }) }),
  }),
}));
const account = (id: string): UserProfile => ({
  id, username: id, email: `${id}@example.test`, full_name: id, role: "user",
  avatar_url: null, preferences: DEFAULT_USER_PREFERENCES,
});

describe("authentication cache and async profile isolation", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient();
    vi.clearAllMocks();
    useAppStore.getState().setUser(account("alice"));
    mock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mock.unsubscribe } } });
    mock.getUser.mockResolvedValue({ data: { user: { id: "alice", email: "alice@example.test", user_metadata: {} } } });
  });
  afterEach(() => { cleanup(); client.clear(); useAppStore.getState().setUser(null); });

  it("clears private caches immediately on logout and ignores the old pending profile", async () => {
    let resolveProfile!: (value: { data: UserProfile }) => void;
    mock.maybeSingle.mockImplementation(() => new Promise((resolve) => { resolveProfile = resolve; }));
    client.setQueryData(["portfolio", "holdings"], ["alice-private-holding"]);
    render(<QueryClientProvider client={client}><AuthSync /></QueryClientProvider>);
    await waitFor(() => expect(mock.maybeSingle).toHaveBeenCalledOnce());
    mock.getUser.mockResolvedValue({ data: { user: null } });
    await act(async () => { mock.onAuthStateChange.mock.calls[0][0]("SIGNED_OUT", null); });
    expect(useAppStore.getState().user).toBeNull();
    expect(client.getQueryData(["portfolio", "holdings"])).toBeUndefined();
    await act(async () => { resolveProfile({ data: account("alice") }); });
    expect(useAppStore.getState().user).toBeNull();
  });

  it("keeps a newer account when an older hydration finishes last", async () => {
    let resolveAlice!: (value: { data: UserProfile }) => void;
    mock.maybeSingle.mockImplementationOnce(() => new Promise((resolve) => { resolveAlice = resolve; }))
      .mockResolvedValue({ data: account("bob") });
    render(<QueryClientProvider client={client}><AuthSync /></QueryClientProvider>);
    await waitFor(() => expect(mock.maybeSingle).toHaveBeenCalledOnce());
    mock.getUser.mockResolvedValue({ data: { user: { id: "bob", email: "bob@example.test", user_metadata: {} } } });
    await act(async () => { mock.onAuthStateChange.mock.calls[0][0]("SIGNED_IN", { user: { id: "bob" } }); });
    await waitFor(() => expect(useAppStore.getState().user?.id).toBe("bob"));
    await act(async () => { resolveAlice({ data: account("alice") }); });
    expect(useAppStore.getState().user?.id).toBe("bob");
  });
});
