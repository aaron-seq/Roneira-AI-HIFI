// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { PortfolioHistory, PortfolioSnapshot } from "@/lib/portfolio/history";
import { DEFAULT_USER_PREFERENCES, useAppStore } from "@/lib/stores/app-store";
import { usePortfolioHistory } from "./use-portfolio-history";

const mock = vi.hoisted(() => ({ fetch: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  createClient: () => ({ auth: { getUser: mock.getUser } }),
}));

function user(id: string) {
  return { id, username: id, full_name: id, email: `${id}@example.test`, role: "user" as const,
    avatar_url: null, preferences: DEFAULT_USER_PREFERENCES };
}
function snapshot(currency: "INR" | "USD" = "INR"): PortfolioSnapshot {
  return { id: `snapshot-${currency}`, valuedOn: new Date().toISOString().slice(0, 10), capturedAt: new Date().toISOString(), holdingsObservedAt: new Date().toISOString(),
    currency, investedValue: 100, currentValue: 110, pnl: 10, pnlPercent: 10, totalHoldings: 1, pricedHoldings: 1,
    coverageComplete: true, usdInr: null, exclusions: [], quoteSources: [] };
}
function history(snapshots = [snapshot()], currency: "INR" | "USD" = "INR"): PortfolioHistory {
  return { currency, days: 90, snapshots, methodology: ["Saved observations only."] };
}
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("private portfolio history", () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mock.fetch.mockReset(); mock.getUser.mockReset();
    mock.getUser.mockImplementation(async () => ({ data: { user: { id: useAppStore.getState().user?.id } }, error: null }));
    useAppStore.getState().setUser(user("account-a"));
    vi.stubGlobal("fetch", mock.fetch);
  });
  afterEach(() => { cleanup(); client.clear(); useAppStore.getState().setUser(null); vi.unstubAllGlobals(); });

  it("does not request private history or capture for a signed-out visitor", async () => {
    useAppStore.getState().setUser(null);
    const { result } = renderHook(() => usePortfolioHistory("INR"), { wrapper });
    expect(result.current.isSignedIn).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mock.getUser).not.toHaveBeenCalled();
    expect(mock.fetch).not.toHaveBeenCalled();
  });

  it("loads the requested currency/range without storing secrets or sending a user ID", async () => {
    mock.fetch.mockImplementation(async () => json(history()));
    const { result } = renderHook(() => usePortfolioHistory("INR"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.snapshots[0].pnl).toBe(10);
    expect(mock.fetch).toHaveBeenCalledOnce();
    expect(mock.fetch.mock.calls[0][0]).toBe("/api/portfolio/history?currency=INR&days=90");
    expect(mock.fetch.mock.calls[0][1]).toMatchObject({ cache: "no-store", signal: expect.any(AbortSignal) });
  });

  it("automatically captures a missing UTC day once, deriving totals on the server", async () => {
    let saved = false;
    mock.fetch.mockImplementation(async (_url, options) => {
      if (options.method === "POST") { saved = true; return json({ snapshot: snapshot(), methodology: [] }); }
      return json(history(saved ? [snapshot()] : []));
    });
    const { result, rerender } = renderHook(() => usePortfolioHistory("INR"), { wrapper });
    await waitFor(() => expect(result.current.data?.snapshots).toHaveLength(1));
    rerender(); rerender();
    const posts = mock.fetch.mock.calls.filter(([, options]) => options.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0][1].body)).toEqual({ currency: "INR" });
  });

  it("does not automatically recapture a saved day", async () => {
    mock.fetch.mockImplementation(async () => json(history()));
    const { result, rerender } = renderHook(() => usePortfolioHistory("INR"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender();
    expect(mock.fetch.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
  });

  it("does not loop or retry a failed automatic capture across re-renders and remounts", async () => {
    mock.fetch.mockImplementation(async (_url, options) => options.method === "POST"
      ? json({ error: "Provider unavailable" }, 503) : json(history([])));
    const first = renderHook(() => usePortfolioHistory("INR"), { wrapper });
    await waitFor(() => expect(first.result.current.capture.isError).toBe(true));
    first.rerender(); first.unmount();
    const second = renderHook(() => usePortfolioHistory("INR"), { wrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    expect(mock.fetch.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
  });

  it("allows an explicit capture retry after an automatic failure", async () => {
    let attempts = 0;
    mock.fetch.mockImplementation(async (_url, options) => {
      if (options.method === "POST") return ++attempts === 1 ? json({ error: "Provider unavailable" }, 503) : json({ snapshot: snapshot(), methodology: [] });
      return json(history(attempts > 1 ? [snapshot()] : []));
    });
    const { result } = renderHook(() => usePortfolioHistory("INR"), { wrapper });
    await waitFor(() => expect(result.current.capture.isError).toBe(true));
    await act(async () => { await result.current.capture.mutateAsync(); });
    await waitFor(() => expect(result.current.data?.snapshots).toHaveLength(1));
    expect(attempts).toBe(2);
  });

  it("keeps currency histories separate and invalidates the captured currency only", async () => {
    mock.fetch.mockImplementation(async (url, options) => {
      if (options.method === "POST") return json({ snapshot: snapshot("USD"), methodology: [] });
      return json(url.includes("currency=USD") ? history([snapshot("USD")], "USD") : history());
    });
    const { result, rerender } = renderHook(({ currency }: { currency: "INR" | "USD" }) => usePortfolioHistory(currency), { initialProps: { currency: "INR" }, wrapper });
    await waitFor(() => expect(result.current.data?.currency).toBe("INR"));
    rerender({ currency: "USD" });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.currency).toBe("USD"));
    const inrRequests = mock.fetch.mock.calls.filter(([url]) => url.includes("currency=INR")).length;
    await act(async () => { await result.current.capture.mutateAsync(); });
    expect(mock.fetch.mock.calls.filter(([url]) => url.includes("currency=INR"))).toHaveLength(inrRequests);
    expect(JSON.parse(mock.fetch.mock.calls.find(([, options]) => options.method === "POST")![1].body)).toEqual({ currency: "USD" });
  });

  it("exposes a history failure and recovers on explicit retry without automatic write retries", async () => {
    mock.fetch.mockImplementation(async () => json({ error: "Database unavailable" }, 503));
    const { result } = renderHook(() => usePortfolioHistory("INR"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Database unavailable");
    expect(mock.fetch).toHaveBeenCalledOnce();
    mock.fetch.mockImplementation(async () => json(history()));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rejects a session that does not match the displayed account before requesting data", async () => {
    mock.getUser.mockResolvedValue({ data: { user: { id: "other-account" } }, error: null });
    const { result } = renderHook(() => usePortfolioHistory("INR"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("session changed");
    expect(mock.fetch).not.toHaveBeenCalled();
  });

  it("discards an old GET response after an account switch and aborts its request", async () => {
    const old = deferred<Response>();
    mock.fetch.mockImplementationOnce(() => old.promise).mockImplementation(async () => json(history([{ ...snapshot(), id: "account-b-snapshot", currentValue: 990 }])));
    const { result } = renderHook(() => usePortfolioHistory("INR"), { wrapper });
    await waitFor(() => expect(mock.fetch).toHaveBeenCalledOnce());
    const oldSignal = mock.fetch.mock.calls[0][1].signal as AbortSignal;
    act(() => useAppStore.getState().setUser(user("account-b")));
    await waitFor(() => expect(result.current.data?.snapshots[0].id).toBe("account-b-snapshot"));
    await act(async () => { old.resolve(json(history())); });
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.data?.snapshots[0].currentValue).toBe(990);
    expect(client.getQueriesData({ queryKey: ["portfolio", "history", "account-a", "INR", 90] })
      .every(([, data]) => data === undefined)).toBe(true);
  });

  it("does not send a request after the account changes during auth preflight", async () => {
    const auth = deferred<{ data: { user: { id: string } }; error: null }>();
    mock.getUser.mockImplementationOnce(() => auth.promise);
    mock.fetch.mockImplementation(async () => json(history()));
    const { result } = renderHook(() => usePortfolioHistory("INR"), { wrapper });
    await waitFor(() => expect(mock.getUser).toHaveBeenCalledOnce());
    act(() => useAppStore.getState().setUser(user("account-b")));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => { auth.resolve({ data: { user: { id: "account-a" } }, error: null }); });
    expect(mock.fetch).toHaveBeenCalledOnce();
  });

  it("rejects a stale POST even if the user switches away and back to the same account", async () => {
    const pending = deferred<Response>();
    mock.fetch.mockImplementation(async (_url, options) => options.method === "POST" ? pending.promise : json(history()));
    const { result } = renderHook(() => usePortfolioHistory("INR"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    let mutation!: Promise<unknown>;
    act(() => { mutation = result.current.capture.mutateAsync().catch((error) => error); });
    await waitFor(() => expect(mock.fetch.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1));
    act(() => { useAppStore.getState().setUser(user("account-b")); useAppStore.getState().setUser(user("account-a")); });
    await waitFor(() => expect(mock.fetch.mock.calls.filter(([, options]) => options.method !== "POST")).toHaveLength(2));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const requestsBeforeReply = mock.fetch.mock.calls.length;
    await act(async () => { pending.resolve(json({ snapshot: snapshot(), methodology: [] })); });
    expect(await mutation).toMatchObject({ message: expect.stringContaining("account changed") });
    expect(mock.fetch.mock.calls.length).toBe(requestsBeforeReply);
  });

  it("allows a fresh GET and capture after a batched A to B to A account transition", async () => {
    let version = 0;
    mock.fetch.mockImplementation(async (_url, options) => {
      if (options.method === "POST") { version += 1; return json({ snapshot: snapshot(), methodology: [] }); }
      return json(history([{ ...snapshot(), id: `observation-${version}` }]));
    });
    const { result } = renderHook(() => usePortfolioHistory("INR", 90, false), { wrapper });
    await waitFor(() => expect(result.current.data?.snapshots[0].id).toBe("observation-0"));
    const initialGets = mock.fetch.mock.calls.filter(([, options]) => options.method !== "POST").length;
    act(() => { useAppStore.getState().setUser(user("account-b")); useAppStore.getState().setUser(user("account-a")); });
    await waitFor(() => expect(mock.fetch.mock.calls.filter(([, options]) => options.method !== "POST").length).toBe(initialGets + 1));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => { await result.current.refetch(); });
    expect(result.current.isError).toBe(false);
    await act(async () => { await result.current.capture.mutateAsync(); });
    await waitFor(() => expect(result.current.data?.snapshots[0].id).toBe("observation-1"));
    expect(result.current.capture.isSuccess).toBe(true);
    expect(mock.fetch.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
  });

  it("reattaches history and allows new capture when identity clearing removes the query cache during a round trip", async () => {
    mock.fetch.mockImplementation(async (_url, options) => options.method === "POST"
      ? json({ snapshot: snapshot(), methodology: [] }) : json(history()));
    const { result } = renderHook(() => usePortfolioHistory("INR", 90, false), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => {
      useAppStore.getState().setUser(null); client.clear();
      useAppStore.getState().setUser(user("account-a"));
    });
    await waitFor(() => expect(mock.fetch.mock.calls).toHaveLength(2));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => { await result.current.capture.mutateAsync(); });
    await waitFor(() => expect(result.current.capture.isSuccess).toBe(true));
    expect(result.current.data?.snapshots[0].id).toBe("snapshot-INR");
    expect(mock.fetch.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
  });
});
