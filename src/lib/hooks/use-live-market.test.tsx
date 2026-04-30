import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { useLiveQuotes } from "./use-live-market";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useLiveQuotes", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("should not fetch data when symbols array is empty", async () => {
    // Tests that the 'enabled' option correctly evaluates to false, stopping the query.
    // NOTE: This reflects the current implementation in `use-live-market.ts` using react-query.
    // The previous prompt describing a `useEffect` and `useState` utilizing websockets is not found in the actual codebase.
    const { result } = renderHook(() => useLiveQuotes([]), { wrapper });

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle"); // If enabled is false, fetchStatus is idle, meaning it didn't fetch.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should fetch data when symbols are provided", async () => {
    const mockData = { data: [{ symbol: "AAPL", price: 150 }] };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useLiveQuotes(["AAPL", "MSFT"]), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/market-data?symbols=AAPL%2CMSFT"),
      expect.any(Object)
    );
    expect(result.current.data).toEqual(mockData);
  });

  it("should filter out empty strings and trim symbols", async () => {
    const mockData = { data: [{ symbol: "AAPL", price: 150 }] };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useLiveQuotes([" AAPL ", "", "MSFT "]), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/market-data?symbols=AAPL%2CMSFT"),
      expect.any(Object)
    );
  });
});
