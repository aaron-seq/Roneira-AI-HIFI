"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { logAuditEvent } from "@/lib/client/audit";
import { createClient } from "@/lib/supabase/client";
import { useLiveQuotes } from "@/lib/hooks/use-live-market";
import type { MarketQuote } from "@/lib/market/types";

type WatchlistItem = {
  id: string;
  ticker: string;
  exchange: string;
  notes: string | null;
  alert_price: number | null;
  sort_order: number;
  added_at: string;
};

export type WatchlistRow = WatchlistItem & {
  name: string;
  price: number;
  changePercent: number;
};

async function fetchWatchlist() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("watchlist")
    .select("id, ticker, exchange, notes, alert_price, sort_order, added_at")
    .order("sort_order", { ascending: true })
    .order("added_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as WatchlistItem[]) ?? [];
}

export function useWatchlist() {
  const queryClient = useQueryClient();
  const itemsQuery = useQuery({
    queryKey: ["watchlist"],
    queryFn: fetchWatchlist,
  });
  const symbols = (itemsQuery.data ?? []).map((row) => row.ticker);
  const quotesQuery = useLiveQuotes(symbols);
  const quotesBySymbol = new Map(
    ((quotesQuery.data?.data ?? []) as MarketQuote[]).map((quote) => [
      quote.symbol,
      quote,
    ])
  );

  const rows: WatchlistRow[] = (itemsQuery.data ?? []).map((item) => {
    const quote = quotesBySymbol.get(item.ticker);
    return {
      ...item,
      name: quote?.name ?? item.ticker,
      price: quote?.price ?? 0,
      changePercent: quote?.changePercent ?? 0,
    };
  });

  const addMutation = useMutation({
    mutationFn: async (payload: {
      symbol: string;
      exchange: string;
      notes?: string;
    }) => {
      const supabase = createClient();
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult.user?.id;
      if (!userId) {
        throw new Error("You must be signed in to update your watchlist.");
      }

      const { error } = await supabase.from("watchlist").insert({
        user_id: userId,
        ticker: payload.symbol,
        exchange: payload.exchange,
        notes: payload.notes ?? "",
        sort_order: rows.length,
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("watchlist").delete().eq("id", id);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });

  const alertMutation = useMutation({
    mutationFn: async (payload: { id: string; alertPrice: number | null }) => {
      const existingRow = rows.find((row) => row.id === payload.id);
      const supabase = createClient();
      const { error } = await supabase
        .from("watchlist")
        .update({ alert_price: payload.alertPrice })
        .eq("id", payload.id);

      if (error) {
        throw error;
      }

      await logAuditEvent({
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
