"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { logAuditEvent } from "@/lib/client/audit";
import { createClient } from "@/lib/supabase/client";
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

async function fetchHoldings() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("portfolio_holdings")
    .select(
      "id, ticker, company_name, exchange, quantity, avg_buy_price, buy_date, sector, tags"
    )
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as PortfolioHolding[]) ?? [];
}

export function usePortfolio() {
  const queryClient = useQueryClient();
  const holdingsQuery = useQuery({
    queryKey: ["portfolio", "holdings"],
    queryFn: fetchHoldings,
  });
  const holdings = holdingsQuery.data ?? [];
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
      const supabase = createClient();
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult.user?.id;
      if (!userId) {
        throw new Error("You must be signed in to update your portfolio.");
      }

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
          .eq("id", payload.id);

        if (error) {
          throw error;
        }

        await logAuditEvent({
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
        user_id: userId,
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

      await logAuditEvent({
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
    mutationFn: async (id: string) => {
      const existingRow = holdings.find((row) => row.id === id);
      const supabase = createClient();
      const { error } = await supabase
        .from("portfolio_holdings")
        .delete()
        .eq("id", id);
      if (error) {
        throw error;
      }

      await logAuditEvent({
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
