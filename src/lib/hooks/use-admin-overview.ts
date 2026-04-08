"use client";

import { useQuery } from "@tanstack/react-query";
import type { AdminOverview } from "@/lib/market/types";

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

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => fetchJson<AdminOverview>("/api/admin/overview"),
    refetchInterval: 60_000,
  });
}
