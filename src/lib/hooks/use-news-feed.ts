"use client";

import { useQuery } from "@tanstack/react-query";
import type { NewsArticle } from "@/lib/market/types";
import { useAppStore } from "@/lib/stores/app-store";

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

export function useNewsFeed(market: "global" | "india", query: string) {
  const userId = useAppStore((state) => state.user?.id ?? null);
  return useQuery({
    queryKey: ["news", market, query, userId],
    queryFn: () =>
      fetchJson<{ articles: NewsArticle[]; totalResults: number }>(
        `/api/news?market=${encodeURIComponent(market)}&q=${encodeURIComponent(
          query
        )}`
      ),
    refetchInterval: 5 * 60_000,
  });
}
