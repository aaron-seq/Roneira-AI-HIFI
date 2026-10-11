// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DEFAULT_USER_PREFERENCES, useAppStore, type UserProfile } from "@/lib/stores/app-store";
import { useNotifications } from "./use-notifications";

const mock = vi.hoisted(() => ({ createClient: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  createClient: mock.createClient,
}));

const account = (id: string): UserProfile => ({
  id, username: id, email: `${id}@example.test`, full_name: id,
  role: "user", avatar_url: null, preferences: DEFAULT_USER_PREFERENCES,
});
const notification = (id: string) => ({
  id, kind: "price_alert", ticker: "TCS.NS", title: `${id}'s private alert`,
  body: null, created_at: "2026-10-09T10:30:00Z", read_at: null,
});

describe("notification account isolation", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: {
      queries: { retry: false }, mutations: { retry: 1, retryDelay: 0 },
    } });
    mock.createClient.mockReset();
    mock.eq.mockReset();
    useAppStore.getState().setUser(null);
  });
  afterEach(() => { cleanup(); client.clear(); useAppStore.getState().setUser(null); });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  it("does not fetch or show cached alerts before identity is known", () => {
    client.setQueryData(["notifications", "alice"], [notification("alice")]);
    const { result } = renderHook(useNotifications, { wrapper });
    expect(result.current.rows).toEqual([]);
    expect(mock.createClient).not.toHaveBeenCalled();
  });

  it("never presents the previous account's fresh cache after switching accounts", async () => {
    useAppStore.getState().setUser(account("alice"));
    client.setQueryData(["notifications", "alice"], [notification("alice")]);
    mock.eq.mockReturnValue({ order: () => ({ limit: async () => ({ data: [notification("bob")], error: null }) }) });
    mock.createClient.mockReturnValue({ from: () => ({ select: () => ({ eq: mock.eq }) }) });
    const { result } = renderHook(useNotifications, { wrapper });
    expect(result.current.rows[0].id).toBe("alice");
    act(() => useAppStore.getState().setUser(account("bob")));
    expect(result.current.rows.some((row) => row.id === "alice")).toBe(false);
    await waitFor(() => expect(result.current.rows[0]?.id).toBe("bob"));
    expect(mock.eq).toHaveBeenCalledWith("user_id", "bob");
    act(() => useAppStore.getState().setUser(null));
    expect(result.current.rows).toEqual([]);
    expect(result.current.unread).toBe(0);
  });

  it("does not retry a failed old-account write using the new account's identity", async () => {
    useAppStore.getState().setUser(account("alice"));
    for (const id of ["alice", "bob"]) client.setQueryData(["notifications", id], [notification(id)]);
    let rejectWrite!: (reason: Error) => void;
    const write = new Promise<never>((_resolve, reject) => { rejectWrite = reject; });
    const scopeWrite = vi.fn(() => ({ is: () => write }));
    const update = vi.fn(() => ({ eq: scopeWrite }));
    mock.createClient.mockReturnValue({ from: () => ({ update }) });
    const { result } = renderHook(useNotifications, { wrapper });
    let outcome!: Promise<unknown>;
    act(() => { outcome = result.current.markAllRead.mutateAsync().catch((error) => error); });
    await waitFor(() => expect(scopeWrite).toHaveBeenCalledWith("user_id", "alice"));
    act(() => useAppStore.getState().setUser(account("bob")));
    await act(async () => { rejectWrite(new Error("transient write failure")); await outcome; });
    expect(update).toHaveBeenCalledOnce();
    expect(scopeWrite).not.toHaveBeenCalledWith("user_id", "bob");
  });

  it("retains the intended account when identity changes before a write starts", async () => {
    useAppStore.getState().setUser(account("alice"));
    for (const id of ["alice", "bob"]) client.setQueryData(["notifications", id], [notification(id)]);
    const scopeWrite = vi.fn(() => ({ is: async () => ({ error: null }) }));
    mock.createClient.mockReturnValue({ from: () => ({ update: () => ({ eq: scopeWrite }) }) });
    const { result } = renderHook(useNotifications, { wrapper });
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.markAllRead.mutateAsync();
      useAppStore.getState().setUser(account("bob"));
    });
    await act(async () => { await pending; });
    expect(scopeWrite).toHaveBeenCalledWith("user_id", "alice");
    expect(scopeWrite).not.toHaveBeenCalledWith("user_id", "bob");
  });
});
