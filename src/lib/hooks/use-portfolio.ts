"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { logAuditEvent, type AuditEventInput } from "@/lib/client/audit";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useLiveQuotes } from "@/lib/hooks/use-live-market";
import type { MarketQuote } from "@/lib/market/types";
import { summarisePortfolio, type Currency } from "@/lib/portfolio/summary";
import { useAppStore } from "@/lib/stores/app-store";

const USD_INR = "USDINR=X";

type PortfolioHolding = {
  id: string;
  ticker: string;
  company_name: string;
  exchange: string;
  quantity: number;
  avg_buy_price: number;
  buy_date: string | null;
  sector: string | null;
  tags: string[];
};

async function fetchHoldings(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("portfolio_holdings")
    .select(
      "id, ticker, company_name, exchange, quantity, avg_buy_price, buy_date, sector, tags"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as PortfolioHolding[]) ?? [];
}

async function accountClient(accountId: string | undefined) {
  if (!accountId || useAppStore.getState().user?.id !== accountId) {
    throw new Error("Your account changed. Reopen the portfolio before saving.");
  }
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user?.id !== accountId || useAppStore.getState().user?.id !== accountId) {
    throw new Error("Your account changed. Reopen the portfolio before saving.");
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

export function usePortfolio() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.user?.id);
  const holdingsQuery = useQuery({
    queryKey: ["portfolio", "holdings", userId],
    queryFn: () => fetchHoldings(userId!),
    enabled: isSupabaseConfigured && Boolean(userId),
  });
  const holdings = userId ? holdingsQuery.data ?? [] : [];
  // USDINR=X rides along with the holdings so mixed INR/USD books can be
  // totalled in one currency instead of adding rupees to dollars.
  const symbols = holdings.map((row) => row.ticker);
  const quotesQuery = useLiveQuotes(symbols.length > 0 ? [...symbols, USD_INR] : []);
  const quotesBySymbol = new Map(
    ((quotesQuery.data?.data ?? []) as MarketQuote[]).map((quote) => [
      quote.symbol,
      quote,
    ])
  );
  const base: Currency = useAppStore((state) =>
    state.user?.preferences.defaultMarket === "NASDAQ" ||
    state.user?.preferences.defaultMarket === "NYSE"
      ? "USD"
      : "INR"
  );
  const summary = summarisePortfolio(
    holdings,
    quotesBySymbol,
    quotesBySymbol.get(USD_INR)?.price ?? null,
    base
  );

  const upsertMutation = useMutation({
    // Changing the mutation key detaches the old mutation from new-account
    // hook options, preserving its original account even before execution.
    mutationKey: ["portfolio", "upsert", userId],
    retry: false,
    mutationFn: async (payload: {
      id?: string;
      ticker: string;
      company_name: string;
      exchange: string;
      quantity: number;
      avg_buy_price: number;
      buy_date?: string | null;
      sector?: string | null;
      tags?: string[];
    }) => {
      const { supabase, accountId } = await accountClient(userId);

      if (payload.id) {
        const { error } = await supabase
          .from("portfolio_holdings")
          .update({
            ticker: payload.ticker,
            company_name: payload.company_name,
            exchange: payload.exchange,
            quantity: payload.quantity,
            avg_buy_price: payload.avg_buy_price,
            buy_date: payload.buy_date ?? null,
            sector: payload.sector ?? null,
            tags: payload.tags ?? [],
          })
          .eq("id", payload.id)
          .eq("user_id", accountId);

        if (error) {
          throw error;
        }

        await logAccountEvent(supabase, accountId, {
          actionType: "EDIT_HOLDING",
          entityType: "portfolio",
          entityId: payload.id,
          newValues: {
            ticker: payload.ticker,
            quantity: payload.quantity,
            avg_buy_price: payload.avg_buy_price,
          },
        }).catch(() => undefined);
        return;
      }

      const { error } = await supabase.from("portfolio_holdings").insert({
        user_id: accountId,
        ticker: payload.ticker,
        company_name: payload.company_name,
        exchange: payload.exchange,
        quantity: payload.quantity,
        avg_buy_price: payload.avg_buy_price,
        buy_date: payload.buy_date ?? null,
        sector: payload.sector ?? null,
        tags: payload.tags ?? [],
      });

      if (error) {
        throw error;
      }

      await logAccountEvent(supabase, accountId, {
        actionType: "ADD_STOCK",
        entityType: "portfolio",
        newValues: {
          ticker: payload.ticker,
          quantity: payload.quantity,
          avg_buy_price: payload.avg_buy_price,
        },
      }).catch(() => undefined);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["portfolio", "holdings"] });
    },
  });

  const removeMutation = useMutation({
    mutationKey: ["portfolio", "remove", userId],
    retry: false,
    mutationFn: async (id: string) => {
      const existingRow = holdings.find((row) => row.id === id);
      const { supabase, accountId } = await accountClient(userId);
      const { error } = await supabase
        .from("portfolio_holdings")
        .delete()
        .eq("id", id)
        .eq("user_id", accountId);
      if (error) {
        throw error;
      }

      await logAccountEvent(supabase, accountId, {
        actionType: "DELETE_HOLDING",
        entityType: "portfolio",
        entityId: id,
        oldValues: { ticker: existingRow?.ticker ?? null },
      }).catch(() => undefined);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["portfolio", "holdings"] });
    },
  });

  return {
    ...holdingsQuery,
    summary,
    upsertMutation,
    removeMutation,
    isLoading:
      holdingsQuery.isLoading || (symbols.length > 0 && quotesQuery.isLoading),
  };
}
