// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCommoditiesForexData, useLiveQuotes, useMarketOverviewData, usePeerComparison, useQuoteHistory, useStockScreener } from "./use-live-market";
import { DEFAULT_USER_PREFERENCES, useAppStore } from "@/lib/stores/app-store";
import { useNewsFeed } from "./use-news-feed";

describe("live quote request behavior", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAppStore.getState().setUser(null);
  });
  afterEach(() => {
    cleanup();
    client.clear();
    useAppStore.getState().setUser(null);
    vi.unstubAllGlobals();
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  it.each([{ symbols: [] }, { symbols: ["", "   "] }])("does not request data for an empty symbol list ($symbols)", ({ symbols }) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLiveQuotes(symbols), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests each cleaned symbol once and returns the provider quotes", async () => {
    const payload = { data: [{ symbol: "AAPL", price: 150 }, { symbol: "TCS.NS", price: 3000 }] };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLiveQuotes([" AAPL ", "", "AAPL", " TCS.NS "]), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "/api/market-data?symbols=AAPL%2CTCS.NS",
      { headers: { Accept: "application/json" } }
    );
    expect(result.current.data).toEqual(payload);
  });

  it("surfaces an unavailable provider as an error instead of an empty successful book", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    const { result } = renderHook(() => useLiveQuotes(["TCS.NS"]), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Request failed: 503");
    expect(result.current.data).toBeUndefined();
  });

  it.each([
    { name: "overview", useHook: useMarketOverviewData },
    { name: "commodities", useHook: useCommoditiesForexData },
    { name: "quotes", useHook: () => useLiveQuotes(["TCS.NS"]) },
    { name: "history", useHook: () => useQuoteHistory("TCS.NS") },
    { name: "screener", useHook: useStockScreener },
    { name: "peers", useHook: () => usePeerComparison("TCS.NS") },
    { name: "news", useHook: () => useNewsFeed("india", "") },
  ])("reattaches $name after authentication clears a pending public request", async ({ useHook }) => {
    let resolveOld!: (response: Response) => void;
    const current = { data: [{ symbol: "TCS.NS", price: 110 }] };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveOld = resolve; }))
      .mockImplementation(async () => new Response(JSON.stringify(current), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook<ReturnType<typeof useHook>, unknown>(() => useHook(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => {
      // Match AuthSync's initial hydration ordering; retain its private-cache guard.
      client.clear();
      useAppStore.getState().setUser({ id: "hydrated-user", username: "fixture", full_name: "Fixture",
        email: "fixture@example.test", role: "user", avatar_url: null, preferences: DEFAULT_USER_PREFERENCES });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(current);
    await act(async () => { resolveOld(new Response(JSON.stringify({ data: [] }), { status: 200 })); });
    expect(result.current.data).toEqual(current);
  });
});
