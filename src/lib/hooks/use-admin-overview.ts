"use client";

import { useQuery } from "@tanstack/react-query";
import type { AdminOverview } from "@/lib/market/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
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

export function useAdminOverview() {
  const user = useAppStore((state) => state.user);
  return useQuery({
    queryKey: ["admin", "overview", user?.id, user?.role],
    queryFn: () => fetchJson<AdminOverview>("/api/admin/overview"),
    enabled: isSupabaseConfigured && user?.role === "admin",
    refetchInterval: 60_000,
  });
}
