// @vitest-environment jsdom
import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_PREFERENCES, useAppStore, type UserProfile } from "@/lib/stores/app-store";
import { AuthSync } from "./AuthSync";
import { useCommoditiesForexData, useLiveQuotes, useMarketOverviewData, usePeerComparison, useQuoteHistory, useStockScreener } from "@/lib/hooks/use-live-market";
import { useNewsFeed } from "@/lib/hooks/use-news-feed";
import { useStockSearch } from "@/lib/hooks/use-prediction";
import type { ReactNode } from "react";

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
  afterEach(() => { cleanup(); client.clear(); useAppStore.getState().setUser(null); vi.unstubAllGlobals(); });

  it.each([
    { name: "overview", useHook: useMarketOverviewData },
    { name: "commodities", useHook: useCommoditiesForexData },
    { name: "quotes", useHook: () => useLiveQuotes(["TCS.NS"]) },
    { name: "history", useHook: () => useQuoteHistory("TCS.NS") },
    { name: "screener", useHook: useStockScreener },
    { name: "peers", useHook: () => usePeerComparison("TCS.NS") },
    { name: "news", useHook: () => useNewsFeed("india", "") },
    { name: "stock search", useHook: () => useStockSearch("TCS") },
  ])("reattaches pending $name after failed hydration leaves the identity null", async ({ useHook }) => {
    useAppStore.getState().setUser(null);
    let rejectHydration!: (reason: Error) => void;
    mock.getUser.mockImplementationOnce(() => new Promise((_, reject) => { rejectHydration = reject; }));
    // Defensive cache erasure is required even if the store is already null.
    client.setQueryData(["portfolio", "holdings", "alice"], ["private-holding"]);
    let resolveOld!: (response: Response) => void;
    const current = { data: [{ symbol: "TCS.NS", price: 110 }] };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveOld = resolve; }))
      .mockImplementation(async () => new Response(JSON.stringify(current), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}><AuthSync />{children}</QueryClientProvider>
    );
    const { result } = renderHook<ReturnType<typeof useHook>, unknown>(() => useHook(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => { rejectHydration(new Error("Profile request unavailable")); });
    expect(useAppStore.getState().user).toBeNull();
    expect(client.getQueryData(["portfolio", "holdings", "alice"])).toBeUndefined();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(current);
    await act(async () => { resolveOld(new Response(JSON.stringify({ data: [] }), { status: 200 })); });
    expect(result.current.data).toEqual(current);
  });

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

  it("reattaches stock search when batched auth changes return to the original account", async () => {
    mock.maybeSingle.mockResolvedValue({ data: account("alice") });
    let resolveOld!: (response: Response) => void;
    const current = { results: [{ ticker: "TCS.NS", name: "TCS" }] };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveOld = resolve; }))
      .mockImplementation(async () => new Response(JSON.stringify(current), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}><AuthSync />{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useStockSearch("TCS"), { wrapper });
    await waitFor(() => expect(mock.maybeSingle).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledOnce();
    client.setQueryData(["portfolio", "holdings", "alice"], ["private-holding"]);

    await act(async () => {
      for (const id of ["bob", "alice"]) {
        mock.getUser.mockResolvedValue({ data: { user: { id, email: `${id}@example.test`, user_metadata: {} } } });
        mock.maybeSingle.mockResolvedValue({ data: account(id) });
        mock.onAuthStateChange.mock.calls[0][0]("SIGNED_IN", { user: { id } });
        // Finish each hydration while React batches the surrounding update.
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(useAppStore.getState().user?.id).toBe(id);
      }
    });

    expect(useAppStore.getState().user?.id).toBe("alice");
    expect(client.getQueryData(["portfolio", "holdings", "alice"])).toBeUndefined();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(result.current.data).toEqual(current);
    await act(async () => { resolveOld(new Response(JSON.stringify({ results: [] }), { status: 200 })); });
    expect(result.current.data).toEqual(current);
  });
});
