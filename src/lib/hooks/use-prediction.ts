"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { PredictionResult, StockSearchResult } from "@/lib/market/types";

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

export function useStockSearch(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: ["stocks", "search", trimmed],
    queryFn: () =>
      fetchJson<{ results: StockSearchResult[] }>(
        `/api/stocks/search?q=${encodeURIComponent(trimmed)}`
      ),
    enabled: trimmed.length > 0,
    staleTime: 5 * 60_000,
  });
}

export function usePredictionMutation() {
  return useMutation({
    mutationFn: async (payload: {
      ticker: string;
      timeframe: string;
      model_type: string;
    }) => {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Prediction request failed");
      }

      return (await response.json()) as PredictionResult;
    },
  });
}
