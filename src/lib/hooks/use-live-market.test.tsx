// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useLiveQuotes } from "./use-live-market";

describe("live quote request behavior", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => {
    cleanup();
    client.clear();
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
});
