"use client";

import { useQuery } from "@tanstack/react-query";
import type { NewsArticle } from "@/lib/market/types";
import { useAppStore } from "@/lib/stores/app-store";
import { fetchJson } from "@/lib/client/fetch-json";

export function useNewsFeed(market: "global" | "india", query: string) {
  const userId = useAppStore((state) => state.user?.id ?? null);
  const authCacheEpoch = useAppStore((state) => state.authCacheEpoch);
  return useQuery({
    queryKey: ["news", market, query, userId, authCacheEpoch],
    queryFn: () =>
      fetchJson<{ articles: NewsArticle[]; totalResults: number }>(
        `/api/news?market=${encodeURIComponent(market)}&q=${encodeURIComponent(
          query
        )}`
      ),
    refetchInterval: 5 * 60_000,
  });
}
