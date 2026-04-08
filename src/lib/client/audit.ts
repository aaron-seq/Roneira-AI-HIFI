export interface AuditEventInput {
  actionType: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

export async function logAuditEvent(event: AuditEventInput) {
  const response = await fetch("/api/audit-log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action_type: event.actionType,
      entity_type: event.entityType,
      entity_id: event.entityId ?? null,
      old_values: event.oldValues ?? null,
      new_values: event.newValues ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error(`Audit log request failed: ${response.status}`);
  }

  return (await response.json()) as { ok: boolean };
}
