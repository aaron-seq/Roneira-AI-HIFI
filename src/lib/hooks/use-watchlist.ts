"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { logAuditEvent, type AuditEventInput } from "@/lib/client/audit";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useLiveQuotes } from "@/lib/hooks/use-live-market";
import type { MarketQuote } from "@/lib/market/types";
import { useAppStore } from "@/lib/stores/app-store";

type WatchlistItem = {
  id: string;
  ticker: string;
  exchange: string;
  notes: string | null;
  alert_price: number | null;
  /** Set by the post-close alert run when the level was touched (ADR 0001). */
  alert_triggered_at: string | null;
  sort_order: number;
  added_at: string;
};

export type WatchlistRow = WatchlistItem & {
  name: string;
  price: number | null;
  changePercent: number | null;
};

async function fetchWatchlist(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("watchlist")
    .select("id, ticker, exchange, notes, alert_price, alert_triggered_at, sort_order, added_at")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("added_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as WatchlistItem[]) ?? [];
}

async function accountClient(accountId: string | undefined) {
  if (!accountId || useAppStore.getState().user?.id !== accountId) {
    throw new Error("Your account changed. Reopen the watchlist before saving.");
  }
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user?.id !== accountId || useAppStore.getState().user?.id !== accountId) {
    throw new Error("Your account changed. Reopen the watchlist before saving.");
  }
  return { supabase, accountId };
}

async function logAccountEvent(
  supabase: ReturnType<typeof createClient>,
  accountId: string,
  event: AuditEventInput
) {
  if (useAppStore.getState().user?.id !== accountId) return;
  const { data } = await supabase.auth.getUser();
  if (data.user?.id !== accountId || useAppStore.getState().user?.id !== accountId) return;
  await logAuditEvent(event);
}

export function useWatchlist() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.user?.id);
  const itemsQuery = useQuery({
    queryKey: ["watchlist", userId],
    queryFn: () => fetchWatchlist(userId!),
    enabled: isSupabaseConfigured && Boolean(userId),
  });
  const items = userId ? itemsQuery.data ?? [] : [];
  const symbols = items.map((row) => row.ticker);
  const quotesQuery = useLiveQuotes(symbols);
  const quotesBySymbol = new Map(
    ((quotesQuery.data?.data ?? []) as MarketQuote[]).map((quote) => [
      quote.symbol,
      quote,
    ])
  );

  const rows: WatchlistRow[] = items.map((item) => {
    const quote = quotesBySymbol.get(item.ticker);
    return {
      ...item,
      name: quote?.name ?? item.ticker,
      price: quote?.price ?? null,
      changePercent: quote?.changePercent ?? null,
    };
  });

  const addMutation = useMutation({
    mutationKey: ["watchlist", "add", userId],
    retry: false,
    mutationFn: async (payload: {
      symbol: string;
      exchange: string;
      notes?: string;
    }) => {
      const { supabase, accountId } = await accountClient(userId);

      const { error } = await supabase.from("watchlist").insert({
        user_id: accountId,
        ticker: payload.symbol,
        exchange: payload.exchange,
        notes: payload.notes ?? "",
        sort_order: rows.length,
      });

      if (error) {
        throw error;
      }

      await logAccountEvent(supabase, accountId, {
        actionType: "ADD_WATCHLIST",
        entityType: "watchlist",
        newValues: { ticker: payload.symbol, exchange: payload.exchange },
      }).catch(() => undefined);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });

  const removeMutation = useMutation({
    mutationKey: ["watchlist", "remove", userId],
    retry: false,
    mutationFn: async (id: string) => {
      const existingRow = rows.find((row) => row.id === id);
      const { supabase, accountId } = await accountClient(userId);
      const { error } = await supabase.from("watchlist").delete().eq("id", id).eq("user_id", accountId);
      if (error) {
        throw error;
      }

      await logAccountEvent(supabase, accountId, {
        actionType: "REMOVE_WATCHLIST",
        entityType: "watchlist",
        entityId: id,
        oldValues: { ticker: existingRow?.ticker ?? null },
      }).catch(() => undefined);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });

  const alertMutation = useMutation({
    mutationKey: ["watchlist", "alert", userId],
    retry: false,
    mutationFn: async (payload: { id: string; alertPrice: number | null }) => {
      const existingRow = rows.find((row) => row.id === payload.id);
      const { supabase, accountId } = await accountClient(userId);
      const { error } = await supabase
        .from("watchlist")
        // Setting a level (or clearing it) re-arms a one-shot alert.
        .update({ alert_price: payload.alertPrice, alert_triggered_at: null })
        .eq("id", payload.id)
        .eq("user_id", accountId);

      if (error) {
        throw error;
      }

      await logAccountEvent(supabase, accountId, {
        actionType: "PRICE_ALERT",
        entityType: "watchlist",
        entityId: payload.id,
        oldValues: {
          alert_price: existingRow?.alert_price ?? null,
        },
        newValues: {
          ticker: existingRow?.ticker ?? null,
          alert_price: payload.alertPrice,
        },
      }).catch(() => undefined);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });

  return {
    ...itemsQuery,
    rows,
    addMutation,
    removeMutation,
    alertMutation,
    isLoading:
      itemsQuery.isLoading || (symbols.length > 0 && quotesQuery.isLoading),
  };
}
