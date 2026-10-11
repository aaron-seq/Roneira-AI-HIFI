// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DEFAULT_USER_PREFERENCES, useAppStore, type UserProfile } from "@/lib/stores/app-store";
import { usePortfolio } from "./use-portfolio";
import { useWatchlist } from "./use-watchlist";
import { useAuditLog } from "./use-audit-log";
import { useAdminOverview } from "./use-admin-overview";

const mock = vi.hoisted(() => ({
  from: vi.fn(), eq: vi.fn(), fetch: vi.fn(), getUser: vi.fn(),
  insert: vi.fn(), update: vi.fn(), remove: vi.fn(), writeEq: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  createClient: () => ({ from: mock.from, auth: { getUser: mock.getUser } }),
}));
vi.mock("@/lib/client/audit", () => ({ logAuditEvent: mock.audit }));
vi.mock("@/lib/hooks/use-live-market", () => ({
  useLiveQuotes: () => ({ data: { data: [] }, isLoading: false }),
}));

const account = (id: string, role: "admin" | "user" = "user"): UserProfile => ({
  id, username: id, email: `${id}@example.test`, full_name: id, role,
  avatar_url: null, preferences: DEFAULT_USER_PREFERENCES,
});
const holding = (id: string) => ({
  id, ticker: `${id}.NS`, company_name: id, exchange: "NSE", quantity: 2,
  avg_buy_price: 10, buy_date: null, sector: null, tags: [],
});
const watchlist = (id: string) => ({
  id, ticker: `${id}.NS`, exchange: "NSE", notes: `${id}'s private note`,
  alert_price: 12, alert_triggered_at: null, sort_order: 0, added_at: "2026-10-09",
});
const audit = (id: string) => ({
  id, user_id: id, action_type: "ADD_STOCK", entity_type: "portfolio", entity_id: null,
  old_values: null, new_values: null, ip_address: null, user_agent: null,
  created_at: "2026-10-09T10:00:00Z",
});
const overview = (id: string) => ({
  userCount: 1, adminCount: 1, predictionCount: 0, mlHealth: null, recentAudit: [],
  recentUsers: [{ ...account(id, "admin"), created_at: "2026-10-09" }],
});

function usePrivateViews() {
  return {
    portfolio: usePortfolio(),
    watchlist: useWatchlist(),
    audit: useAuditLog("all", "all"),
    admin: useAdminOverview(),
  };
}

describe("private account query isolation", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: {
      queries: { retry: false, staleTime: 60_000 }, mutations: { retry: 1, retryDelay: 0 },
    } });
    vi.resetAllMocks();
    useAppStore.getState().setUser(null);
    vi.stubGlobal("fetch", mock.fetch);
    mock.getUser.mockImplementation(async () => ({ data: { user: useAppStore.getState().user } }));
    mock.insert.mockResolvedValue({ error: null });
    mock.audit.mockResolvedValue(undefined);
    mock.from.mockImplementation((table: string) => {
      let userId = "";
      let userIds: string[] = [];
      let writing = false;
      const chain = {
        select: () => chain,
        insert: mock.insert,
        update: (payload: unknown) => { writing = true; mock.update(table, payload); return chain; },
        delete: () => { writing = true; mock.remove(table); return chain; },
        eq: (column: string, value: string) => {
          mock.eq(table, column, value);
          if (writing) mock.writeEq(table, column, value);
          if (column === "user_id") userId = value;
          return chain;
        },
        in: (_column: string, values: string[]) => { userIds = values; return chain; },
        order: () => chain,
        limit: () => chain,
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => {
          const data = table === "portfolio_holdings" ? [holding(userId)]
            : table === "watchlist" ? [watchlist(userId)]
              : table === "audit_log" ? [audit(userId)]
                : userIds.map((id) => ({ id, username: id }));
          return Promise.resolve(resolve({ data, error: null }));
        },
      };
      return chain;
    });
  });
  afterEach(() => {
    cleanup(); client.clear(); useAppStore.getState().setUser(null); vi.unstubAllGlobals();
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const seedAlice = () => {
    useAppStore.getState().setUser(account("alice"));
    client.setQueryData(["portfolio", "holdings", "alice"], [holding("alice")]);
    client.setQueryData(["watchlist", "alice"], [watchlist("alice")]);
    client.setQueryData(["audit", "alice", false, "all", "all"], [audit("alice")]);
    client.setQueryData(["audit", "users", "alice", false, "alice"], new Map([["alice", "alice"]]));
  };
  const createHolding = { ticker: "TCS.NS", company_name: "TCS", exchange: "NSE", quantity: 2, avg_buy_price: 10 };

  it("retains missing watchlist quotes as unknown values", () => {
    seedAlice();
    const { result } = renderHook(() => useWatchlist(), { wrapper });
    expect(result.current.rows[0].price).toBeNull();
    expect(result.current.rows[0].changePercent).toBeNull();
  });

  it("does not fetch any private view while the account is unknown", () => {
    client.setQueryData(["watchlist", "alice"], [watchlist("alice")]);
    const { result } = renderHook(usePrivateViews, { wrapper });
    expect(result.current.watchlist.rows).toEqual([]);
    expect(result.current.portfolio.summary.rows).toEqual([]);
    expect(result.current.audit.rows).toEqual([]);
    expect(result.current.admin.data).toBeUndefined();
    expect(mock.from).not.toHaveBeenCalled();
    expect(mock.fetch).not.toHaveBeenCalled();
  });

  it("replaces active holding, watchlist and audit observers when the account changes", async () => {
    seedAlice();
    const { result } = renderHook(usePrivateViews, { wrapper });
    expect(result.current.watchlist.rows[0].id).toBe("alice");
    expect(result.current.portfolio.summary.rows[0].holding.id).toBe("alice");
    expect(result.current.audit.rows[0].id).toBe("alice");
    // No AuthSync/cache clearing here: the still-mounted hooks must change
    // observers themselves rather than keeping the old account's result.
    act(() => useAppStore.getState().setUser(account("bob")));
    expect(result.current.watchlist.rows).toEqual([]);
    expect(result.current.portfolio.summary.rows).toEqual([]);
    expect(result.current.audit.rows).toEqual([]);
    await waitFor(() => {
      expect(result.current.watchlist.rows[0]?.id).toBe("bob");
      expect(result.current.portfolio.summary.rows[0]?.holding.id).toBe("bob");
      expect(result.current.audit.rows[0]?.id).toBe("bob");
    });
    for (const table of ["watchlist", "portfolio_holdings", "audit_log"]) {
      expect(mock.eq).toHaveBeenCalledWith(table, "user_id", "bob");
    }
    expect(client.getQueryData(["watchlist", "alice"])).toBeDefined();
    act(() => useAppStore.getState().setUser(null));
    expect(result.current.watchlist.rows).toEqual([]);
    expect(result.current.portfolio.summary.rows).toEqual([]);
    expect(result.current.audit.rows).toEqual([]);
  });

  it("hides an administrator's fresh overview immediately for a regular account", () => {
    useAppStore.getState().setUser(account("alice", "admin"));
    client.setQueryData(["admin", "overview", "alice", "admin"], overview("alice"));
    const { result } = renderHook(useAdminOverview, { wrapper });
    expect(result.current.data?.recentUsers[0].id).toBe("alice");
    act(() => useAppStore.getState().setUser(account("bob")));
    expect(result.current.data).toBeUndefined();
    expect(mock.fetch).not.toHaveBeenCalled();
  });

  it("does not reuse another administrator's overview or elevated role cache", async () => {
    useAppStore.getState().setUser(account("alice", "admin"));
    client.setQueryData(["admin", "overview", "alice", "admin"], overview("alice"));
    mock.fetch.mockResolvedValue({ ok: true, json: async () => overview("bob") });
    const { result } = renderHook(useAdminOverview, { wrapper });
    act(() => useAppStore.getState().setUser(account("bob", "admin")));
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.recentUsers[0].id).toBe("bob"));
    act(() => useAppStore.getState().setUser(account("bob")));
    expect(result.current.data).toBeUndefined();
    expect(mock.fetch).toHaveBeenCalledOnce();
  });

  it.each(["portfolio", "watchlist"])("rejects a pending %s create when authentication changes to another account", async (view) => {
    seedAlice();
    let resolveUser!: (value: { data: { user: UserProfile } }) => void;
    mock.getUser.mockImplementationOnce(() => new Promise((resolve) => { resolveUser = resolve; }));
    const { result } = renderHook(usePrivateViews, { wrapper });
    let outcome!: Promise<unknown>;
    act(() => {
      outcome = (view === "portfolio"
        ? result.current.portfolio.upsertMutation.mutateAsync(createHolding)
        : result.current.watchlist.addMutation.mutateAsync({ symbol: "TCS.NS", exchange: "NSE" }))
        .catch((error) => error);
    });
    await waitFor(() => expect(mock.getUser).toHaveBeenCalledOnce());
    act(() => useAppStore.getState().setUser(account("bob")));
    let failure: unknown;
    await act(async () => { resolveUser({ data: { user: account("bob") } }); failure = await outcome; });
    expect(failure).toBeInstanceOf(Error);
    expect(mock.insert).not.toHaveBeenCalled();
    expect(mock.audit).not.toHaveBeenCalled();
  });

  it.each(["portfolio", "watchlist"])("keeps the original %s mutation identity if the account changes before execution", async (view) => {
    seedAlice();
    const { result } = renderHook(usePrivateViews, { wrapper });
    let outcome!: Promise<unknown>;
    act(() => {
      outcome = (view === "portfolio"
        ? result.current.portfolio.upsertMutation.mutateAsync(createHolding)
        : result.current.watchlist.addMutation.mutateAsync({ symbol: "TCS.NS", exchange: "NSE" }))
        .catch((error) => error);
      useAppStore.getState().setUser(account("bob"));
    });
    let failure: unknown;
    await act(async () => { failure = await outcome; });
    expect(failure).toBeInstanceOf(Error);
    expect(mock.insert).not.toHaveBeenCalled();
    expect(mock.audit).not.toHaveBeenCalled();
  });

  it.each(["portfolio", "watchlist"])("does not retry a failed %s create under a later account", async (view) => {
    seedAlice();
    let rejectWrite!: (error: Error) => void;
    mock.insert.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectWrite = reject; }));
    const { result } = renderHook(usePrivateViews, { wrapper });
    let outcome!: Promise<unknown>;
    act(() => {
      outcome = (view === "portfolio"
        ? result.current.portfolio.upsertMutation.mutateAsync(createHolding)
        : result.current.watchlist.addMutation.mutateAsync({ symbol: "TCS.NS", exchange: "NSE" }))
        .catch((error) => error);
    });
    await waitFor(() => expect(mock.insert).toHaveBeenCalledOnce());
    expect(mock.insert.mock.calls[0][0].user_id).toBe("alice");
    act(() => useAppStore.getState().setUser(account("bob")));
    await act(async () => { rejectWrite(new Error("transient write failure")); await outcome; });
    expect(mock.insert).toHaveBeenCalledOnce();
    expect(mock.audit).not.toHaveBeenCalled();
  });

  it("skips account-specific audit logging after a successful write outlives the account", async () => {
    seedAlice();
    let resolveWrite!: (value: { error: null }) => void;
    mock.insert.mockImplementationOnce(() => new Promise((resolve) => { resolveWrite = resolve; }));
    const { result } = renderHook(usePortfolio, { wrapper });
    let outcome!: Promise<unknown>;
    act(() => { outcome = result.current.upsertMutation.mutateAsync(createHolding); });
    await waitFor(() => expect(mock.insert).toHaveBeenCalledOnce());
    act(() => useAppStore.getState().setUser(account("bob")));
    await act(async () => { resolveWrite({ error: null }); await outcome; });
    expect(mock.audit).not.toHaveBeenCalled();
  });

  it("binds holding and watchlist edits/deletes to the captured account", async () => {
    seedAlice();
    const { result } = renderHook(usePrivateViews, { wrapper });
    await act(async () => {
      await result.current.portfolio.upsertMutation.mutateAsync({ ...createHolding, id: "alice" });
      await result.current.portfolio.removeMutation.mutateAsync("alice");
      await result.current.watchlist.alertMutation.mutateAsync({ id: "alice", alertPrice: 12 });
      await result.current.watchlist.removeMutation.mutateAsync("alice");
    });
    expect(mock.writeEq.mock.calls.filter(([table, column, id]) =>
      table === "portfolio_holdings" && column === "user_id" && id === "alice"
    ).length).toBe(2);
    expect(mock.writeEq.mock.calls.filter(([table, column, id]) =>
      table === "watchlist" && column === "user_id" && id === "alice"
    ).length).toBe(2);
  });
});
