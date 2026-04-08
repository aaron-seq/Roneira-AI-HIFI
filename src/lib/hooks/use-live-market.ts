"use client";

import { useQuery } from "@tanstack/react-query";
import type { CandlePoint, MarketQuote } from "@/lib/market/types";

type MarketOverviewResponse = {
  data: MarketQuote[];
  sections: {
    india: MarketQuote[];
    us: MarketQuote[];
    europe: MarketQuote[];
    special: MarketQuote[];
  };
  movers: {
    gainers: MarketQuote[];
    losers: MarketQuote[];
  };
  timestamp: string;
};

type CommoditiesForexResponse = {
  data: MarketQuote[];
  sections: {
    commodities: MarketQuote[];
    forex: MarketQuote[];
    crypto: MarketQuote[];
  };
  timestamp: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function useMarketOverviewData() {
  return useQuery({
    queryKey: ["market", "overview"],
    queryFn: () =>
      fetchJson<MarketOverviewResponse>("/api/market-data?group=market-overview"),
    refetchInterval: 60_000,
  });
}

export function useCommoditiesForexData() {
  return useQuery({
    queryKey: ["market", "commodities-forex"],
    queryFn: () =>
      fetchJson<CommoditiesForexResponse>(
        "/api/market-data?group=commodities-forex"
      ),
    refetchInterval: 60_000,
  });
}

export function useLiveQuotes(symbols: string[]) {
  const uniqueSymbols = Array.from(
    new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))
  );

  return useQuery({
    queryKey: ["market", "quotes", uniqueSymbols.join(",")],
    queryFn: () =>
      fetchJson<{ data: MarketQuote[] }>(
        `/api/market-data?symbols=${encodeURIComponent(uniqueSymbols.join(","))}`
      ),
    enabled: uniqueSymbols.length > 0,
    refetchInterval: 60_000,
  });
}

export function useQuoteHistory(
  symbol: string | undefined,
  interval = "1day",
  range = "6month"
) {
  return useQuery({
    queryKey: ["market", "history", symbol, interval, range],
    queryFn: () =>
      fetchJson<{ candles: CandlePoint[] }>(
        `/api/market-data/history?symbol=${encodeURIComponent(
          symbol || ""
        )}&interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(
          range
        )}`
      ),
    enabled: Boolean(symbol),
    refetchInterval: 5 * 60_000,
  });
}

export function usePeerComparison(symbol: string | undefined) {
  return useQuery({
    queryKey: ["market", "peers", symbol],
    queryFn: () =>
      fetchJson<{ peers: MarketQuote[] }>(
        `/api/market-data?group=peer-comparison&symbol=${encodeURIComponent(
          symbol || ""
        )}`
      ),
    enabled: Boolean(symbol),
    staleTime: 60_000,
  });
}
