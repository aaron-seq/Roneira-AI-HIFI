// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DEFAULT_USER_PREFERENCES, useAppStore } from "@/lib/stores/app-store";
import { usePortfolio } from "./use-portfolio";

const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }));
const holding = { id: "holding", ticker: "TCS.NS", company_name: "TCS", exchange: "NSE",
  quantity: 2, avg_buy_price: 100, buy_date: null, sector: "Technology", tags: [] };

vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: true, createClient: () => ({
  from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [holding], error: null }) }) }) }),
}) }));
vi.mock("@/lib/client/audit", () => ({ logAuditEvent: vi.fn() }));

const quote = { symbol: "TCS.NS", name: "TCS", exchange: "NSE", assetType: "equity", currency: "INR",
  price: 110, change: 2, changePercent: 1.85, changeAvailable: true, changePercentAvailable: true,
  provider: "yfinance", timestamp: null, sessionDate: "2026-10-09", sessionTimezone: "Asia/Kolkata" };

describe("Portfolio quote state and provenance", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    fetch.mockReset();
    vi.stubGlobal("fetch", fetch);
    useAppStore.getState().setUser({ id: "local-test-user", username: "fixture", email: "fixture@example.test",
      full_name: "Fixture", role: "user", avatar_url: null,
      preferences: { ...DEFAULT_USER_PREFERENCES, defaultMarket: "NSE" } });
  });
  afterEach(() => { cleanup(); client.clear(); useAppStore.getState().setUser(null); vi.unstubAllGlobals(); });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  it("exposes a quote failure without hiding holdings and can retry into an actual valuation", async () => {
    fetch.mockResolvedValue(new Response("Provider unavailable", { status: 503 }));
    const { result } = renderHook(usePortfolio, { wrapper });
    await waitFor(() => expect(result.current.quotesError).toBeTruthy());
    expect(result.current.isError).toBe(false);
    expect(result.current.summary.rows[0].holding.id).toBe("holding");
    expect(result.current.summary.rows[0].price).toBeNull();
    fetch.mockResolvedValue(new Response(JSON.stringify({ data: [quote] })));
    await act(async () => { await result.current.refetchQuotes(); });
    await waitFor(() => expect(result.current.quotesError).toBeNull());
    expect(result.current.summary.current).toBe(220);
    expect(result.current.quotes[0].sessionDate).toBe("2026-10-09");
  });

  it("retains the last priced data but exposes failed refresh instead of presenting a new zero valuation", async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ data: [quote] })));
    const { result } = renderHook(usePortfolio, { wrapper });
    await waitFor(() => expect(result.current.summary.current).toBe(220));
    fetch.mockResolvedValue(new Response("Provider unavailable", { status: 503 }));
    await act(async () => { await result.current.refetchQuotes(); });
    await waitFor(() => expect(result.current.quotesError).toBeTruthy());
    expect(result.current.summary.current).toBe(220);
    expect(result.current.quotes[0].timestamp).toBeNull();
  });
});
