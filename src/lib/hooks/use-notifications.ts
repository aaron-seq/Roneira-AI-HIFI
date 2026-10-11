"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/stores/app-store";

export type NotificationRow = {
  id: string;
  kind: string;
  ticker: string | null;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
};

async function fetchNotifications(userId: string): Promise<NotificationRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, ticker, title, body, created_at, read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data as NotificationRow[]) ?? [];
}

/**
 * Things that happened *to* the user -- fired price alerts today. RLS scopes
 * rows to the signed-in user. Alerts are evaluated once per market close, so
 * a slow refetch is plenty.
 */
export function useNotifications() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.user?.id);
  const key = ["notifications", userId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchNotifications(userId!),
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const rows = userId ? query.data ?? [] : [];

  const markAllRead = useMutation({
    mutationKey: ["notifications", "mark-read", userId],
    // A retry after switching accounts could inherit the new hook closure.
    // The user can explicitly retry this optional read-marker operation.
    retry: false,
    mutationFn: async () => {
      if (!userId) throw new Error("You must be signed in to read notifications.");
      const supabase = createClient();
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    ...query,
    rows,
    unread: rows.filter((row) => row.read_at === null).length,
    markAllRead,
  };
}
