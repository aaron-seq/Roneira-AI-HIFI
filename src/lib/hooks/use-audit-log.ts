"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { AuditLogRow } from "@/lib/market/types";

type UserLookup = {
  id: string;
  username: string;
};

async function fetchAuditRows(
  entityFilter: string,
  actionFilter: string
): Promise<AuditLogRow[]> {
  const supabase = createClient();
  let query = supabase
    .from("audit_log")
    .select(
      "id, user_id, action_type, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (entityFilter !== "all") {
    query = query.eq("entity_type", entityFilter);
  }

  if (actionFilter !== "all") {
    query = query.eq("action_type", actionFilter);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data as AuditLogRow[]) ?? [];
}

async function fetchUserMap(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, username")
    .in("id", userIds);

  if (error) {
    return new Map();
  }

  return new Map(
    ((data as UserLookup[]) ?? []).map((row) => [row.id, row.username])
  );
}

export function useAuditLog(entityFilter: string, actionFilter: string) {
  const rowsQuery = useQuery({
    queryKey: ["audit", entityFilter, actionFilter],
    queryFn: () => fetchAuditRows(entityFilter, actionFilter),
  });

  const userIds = Array.from(
    new Set((rowsQuery.data ?? []).map((row) => row.user_id).filter(Boolean))
  ) as string[];

  const usersQuery = useQuery({
    queryKey: ["audit", "users", userIds.join(",")],
    queryFn: () => fetchUserMap(userIds),
    enabled: userIds.length > 0,
    staleTime: 5 * 60_000,
  });

  const rows = (rowsQuery.data ?? []).map((row) => ({
    ...row,
    username:
      (row.user_id && usersQuery.data?.get(row.user_id)) || "system",
  }));

  return {
    ...rowsQuery,
    rows,
    isLoading:
      rowsQuery.isLoading || (userIds.length > 0 && usersQuery.isLoading),
  };
}
