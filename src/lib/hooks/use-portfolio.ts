"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useLiveQuotes } from "@/lib/hooks/use-live-market";
import type { MarketQuote } from "@/lib/market/types";

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

export type PortfolioRow = PortfolioHolding & {
  currentPrice: number;
  currentValue: number;
  investedValue: number;
  pnl: number;
  pnlPercent: number;
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
  const symbols = (holdingsQuery.data ?? []).map((row) => row.ticker);
  const quotesQuery = useLiveQuotes(symbols);
  const quotesBySymbol = new Map(
    ((quotesQuery.data?.data ?? []) as MarketQuote[]).map((quote) => [
      quote.symbol,
      quote,
    ])
  );

  const rows: PortfolioRow[] = (holdingsQuery.data ?? []).map((holding) => {
    const livePrice =
      quotesBySymbol.get(holding.ticker)?.price ?? holding.avg_buy_price;
    const investedValue = holding.quantity * holding.avg_buy_price;
    const currentValue = holding.quantity * livePrice;
    const pnl = currentValue - investedValue;
    const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

    return {
      ...holding,
      currentPrice: livePrice,
      currentValue,
      investedValue,
      pnl,
      pnlPercent,
    };
  });

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
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["portfolio", "holdings"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("portfolio_holdings")
        .delete()
        .eq("id", id);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["portfolio", "holdings"] });
    },
  });

  return {
    ...holdingsQuery,
    rows,
    upsertMutation,
    removeMutation,
    isLoading:
      holdingsQuery.isLoading || (symbols.length > 0 && quotesQuery.isLoading),
  };
}
