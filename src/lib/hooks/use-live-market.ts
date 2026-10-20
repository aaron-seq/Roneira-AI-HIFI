"use client";

import { useQuery } from "@tanstack/react-query";
import type { CandlePoint, MarketQuote, ScreenerResponse } from "@/lib/market/types";
import { useAppStore } from "@/lib/stores/app-store";

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
  const userId = useAppStore((state) => state.user?.id ?? null);
  const authCacheEpoch = useAppStore((state) => state.authCacheEpoch);
  return useQuery({
    // Reattach after every auth cache clear, even when the final ID is unchanged.
    queryKey: ["market", "overview", userId, authCacheEpoch],
    queryFn: () =>
      fetchJson<MarketOverviewResponse>("/api/market-data?group=market-overview"),
    refetchInterval: 60_000,
  });
}

export function useCommoditiesForexData() {
  const userId = useAppStore((state) => state.user?.id ?? null);
  const authCacheEpoch = useAppStore((state) => state.authCacheEpoch);
  return useQuery({
    queryKey: ["market", "commodities-forex", userId, authCacheEpoch],
    queryFn: () =>
      fetchJson<CommoditiesForexResponse>(
        "/api/market-data?group=commodities-forex"
      ),
    refetchInterval: 60_000,
  });
}

export function useLiveQuotes(symbols: string[]) {
  const userId = useAppStore((state) => state.user?.id ?? null);
  const authCacheEpoch = useAppStore((state) => state.authCacheEpoch);
  const uniqueSymbols = Array.from(
    new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))
  );

  return useQuery({
    queryKey: ["market", "quotes", uniqueSymbols.join(","), userId, authCacheEpoch],
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
  const userId = useAppStore((state) => state.user?.id ?? null);
  const authCacheEpoch = useAppStore((state) => state.authCacheEpoch);
  return useQuery({
    queryKey: ["market", "history", symbol, interval, range, userId, authCacheEpoch],
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

export function useStockScreener() {
  const userId = useAppStore((state) => state.user?.id ?? null);
  const authCacheEpoch = useAppStore((state) => state.authCacheEpoch);
  return useQuery({
    queryKey: ["market", "screener", userId, authCacheEpoch],
    queryFn: () => fetchJson<ScreenerResponse>("/api/screener"),
    // The ML service itself caches this for 30 minutes; matching that here
    // avoids polling a mostly-static dataset every 60s like the price hooks.
    staleTime: 30 * 60_000,
    refetchInterval: 30 * 60_000,
  });
}

export function usePeerComparison(symbol: string | undefined) {
  const userId = useAppStore((state) => state.user?.id ?? null);
  const authCacheEpoch = useAppStore((state) => state.authCacheEpoch);
  return useQuery({
    queryKey: ["market", "peers", symbol, userId, authCacheEpoch],
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
