"use client";

import { useQuery } from "@tanstack/react-query";
import type { AdminOverview } from "@/lib/market/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/stores/app-store";
import { fetchJson } from "@/lib/client/fetch-json";

export function useAdminOverview() {
  const user = useAppStore((state) => state.user);
  return useQuery({
    queryKey: ["admin", "overview", user?.id, user?.role],
    queryFn: () => fetchJson<AdminOverview>("/api/admin/overview"),
    enabled: isSupabaseConfigured && user?.role === "admin",
    refetchInterval: 60_000,
  });
}
