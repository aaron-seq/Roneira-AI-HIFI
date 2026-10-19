"use client";

import { useEffect, useSyncExternalStore } from "react";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PortfolioHistory, PortfolioSnapshot } from "@/lib/portfolio/history";
import type { Currency } from "@/lib/portfolio/summary";
import { useAppStore } from "@/lib/stores/app-store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// A retry after a failure is a deliberate action. Re-renders, Strict Mode and
// remounts must not turn an unavailable provider into a stream of daily writes.
const automaticAttempts = new WeakMap<QueryClient, Set<string>>();
let accountGeneration = 0;
const accountListeners = new Set<() => void>();
useAppStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) {
    accountGeneration += 1;
    accountListeners.forEach((listener) => listener());
  }
});

function subscribeAccountGeneration(listener: () => void) {
  accountListeners.add(listener);
  return () => { accountListeners.delete(listener); };
}
const getAccountGeneration = () => accountGeneration;
const getServerAccountGeneration = () => 0;

function assertAccount(userId: string | undefined, generation: number) {
  if (!userId || useAppStore.getState().user?.id !== userId || generation !== accountGeneration) {
    throw new Error("Your account changed. Reopen portfolio history before saving.");
  }
}

async function accountRequest<T>(
  userId: string | undefined,
  generation: number,
  url: string,
  options: RequestInit,
): Promise<T> {
  assertAccount(userId, generation);
  const { data, error } = await createClient().auth.getUser();
  assertAccount(userId, generation);
  if (error || data.user?.id !== userId) {
    throw new Error("Your session changed. Sign in again to access portfolio history.");
  }
  options.signal?.throwIfAborted();
  const response = await fetch(url, { ...options, cache: "no-store" });
  const payload = await response.json().catch(() => null);
  assertAccount(userId, generation);
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : "Portfolio history is unavailable. Try again.");
  }
  return payload as T;
}

/** Private captures of the observed book, rather than reconstructed returns. */
export function usePortfolioHistory(currency: Currency, days = 90, autoCapture = true) {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.user?.id);
  // An A → B → A transition may be batched into a single render with the same
  // final user ID. Observe the epoch itself so new work gets fresh guards and
  // an observer even if AuthSync cleared the query cache during that transition.
  const generation = useSyncExternalStore(subscribeAccountGeneration, getAccountGeneration, getServerAccountGeneration);
  const queryKey = ["portfolio", "history", userId, currency, days, generation] as const;
  const query = useQuery({
    queryKey,
    enabled: isSupabaseConfigured && Boolean(userId),
    retry: false,
    queryFn: ({ signal }) => accountRequest<PortfolioHistory>(userId, generation,
      `/api/portfolio/history?currency=${currency}&days=${days}`,
      { headers: { Accept: "application/json" }, signal }),
  });
  const capture = useMutation({
    mutationKey: ["portfolio", "capture", userId, currency, generation],
    retry: false,
    mutationFn: () => accountRequest<{ snapshot: PortfolioSnapshot; methodology: readonly string[] }>(
      userId, generation, "/api/portfolio/history", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ currency }),
      }),
    onSuccess: async () => {
      // In-flight work belongs only to the account that started it.
      if (userId !== useAppStore.getState().user?.id || generation !== accountGeneration) return;
      await queryClient.invalidateQueries({ queryKey: ["portfolio", "history", userId, currency] });
    },
  });

  useEffect(() => {
    if (!autoCapture || !userId || !query.isSuccess || query.isFetching || capture.isPending) return;
    const today = new Date().toISOString().slice(0, 10);
    if (query.data.snapshots.some((snapshot) => snapshot.valuedOn === today)) return;
    let attempts = automaticAttempts.get(queryClient);
    if (!attempts) {
      attempts = new Set();
      automaticAttempts.set(queryClient, attempts);
    }
    const attemptKey = `${userId}:${currency}:${today}`;
    if (attempts.has(attemptKey)) return;
    attempts.add(attemptKey);
    capture.mutate();
  }, [autoCapture, userId, currency, query.isSuccess, query.isFetching, query.data, queryClient, capture]);

  return { ...query, data: userId ? query.data : undefined, capture, isSignedIn: Boolean(userId) };
}
