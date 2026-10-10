"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type NotificationRow = {
  id: string;
  kind: string;
  ticker: string | null;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
};

const KEY = ["notifications"];

async function fetchNotifications(): Promise<NotificationRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, ticker, title, body, created_at, read_at")
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
  const query = useQuery({
    queryKey: KEY,
    queryFn: fetchNotifications,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const rows = query.data ?? [];

  const markAllRead = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  return {
    ...query,
    rows,
    unread: rows.filter((row) => row.read_at === null).length,
    markAllRead,
  };
}
