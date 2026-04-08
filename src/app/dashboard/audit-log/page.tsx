"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Brain,
  ChevronDown,
  Clock,
  Edit2,
  FileText,
  Filter,
  LogIn,
  LogOut,
  Plus,
  Settings,
  Star,
  StarOff,
  Trash2,
  User,
  UserPlus,
} from "lucide-react";
import { useAuditLog } from "@/lib/hooks/use-audit-log";

const ACTION_ICONS: Record<string, React.ElementType> = {
  ADD_STOCK: Plus,
  EDIT_HOLDING: Edit2,
  DELETE_HOLDING: Trash2,
  RUN_PREDICTION: Brain,
  LOGIN: LogIn,
  LOGOUT: LogOut,
  ADD_WATCHLIST: Star,
  REMOVE_WATCHLIST: StarOff,
  PRICE_ALERT: Bell,
  SIGNUP: UserPlus,
  SETTINGS_CHANGE: Settings,
};

const ACTION_COLORS: Record<string, string> = {
  ADD_STOCK: "#2ECC71",
  EDIT_HOLDING: "#3498DB",
  DELETE_HOLDING: "#E74C3C",
  RUN_PREDICTION: "#9B59B6",
  LOGIN: "#2ECC71",
  LOGOUT: "#E67E22",
  ADD_WATCHLIST: "#F1C40F",
  REMOVE_WATCHLIST: "#95A5A6",
  PRICE_ALERT: "#F39C12",
  SIGNUP: "#1ABC9C",
  SETTINGS_CHANGE: "#7F8C8D",
};

const ENTITY_FILTERS = [
  "all",
  "portfolio",
  "watchlist",
  "prediction",
  "auth",
  "settings",
];
const ACTION_FILTERS = [
  "all",
  "ADD_STOCK",
  "EDIT_HOLDING",
  "DELETE_HOLDING",
  "RUN_PREDICTION",
  "LOGIN",
  "ADD_WATCHLIST",
  "PRICE_ALERT",
  "SIGNUP",
  "SETTINGS_CHANGE",
];

function StatusIcon({ actionType }: { actionType: string }) {
  const Icon = ACTION_ICONS[actionType] || FileText;
  const color = ACTION_COLORS[actionType] || "#7F8C8D";
  return (
    <div
      className="absolute -left-[39px] top-3 flex h-8 w-8 items-center justify-center rounded-full"
      style={{ background: `${color}20`, border: `2px solid ${color}40` }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color }} />
    </div>
  );
}

export default function AuditLogPage() {
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const auditQuery = useAuditLog(entityFilter, actionFilter);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          Audit Log
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Append-only user and system actions pulled directly from Supabase
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" style={{ color: "var(--color-text-faint)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            Filter:
          </span>
        </div>

        <div className="relative">
          <select
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value)}
            className="appearance-none rounded-lg py-1.5 pl-3 pr-8 text-xs font-medium outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          >
            {ENTITY_FILTERS.map((filterValue) => (
              <option key={filterValue} value={filterValue}>
                {filterValue === "all"
                  ? "All Entities"
                  : `${filterValue.charAt(0).toUpperCase()}${filterValue.slice(1)}`}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: "var(--color-text-faint)" }} />
        </div>

        <div className="relative">
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="appearance-none rounded-lg py-1.5 pl-3 pr-8 text-xs font-medium outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          >
            {ACTION_FILTERS.map((filterValue) => (
              <option key={filterValue} value={filterValue}>
                {filterValue === "all" ? "All Actions" : filterValue.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: "var(--color-text-faint)" }} />
        </div>

        <span className="ml-auto text-xs" style={{ color: "var(--color-text-faint)" }}>
          {auditQuery.rows.length} entries
        </span>
      </div>

      {auditQuery.isLoading ? (
        <div className="card p-6">
          <p style={{ color: "var(--color-text-muted)" }}>Loading audit trail...</p>
        </div>
      ) : auditQuery.isError ? (
        <div className="card p-6">
          <p style={{ color: "var(--color-text-muted)" }}>
            The audit log could not be loaded right now.
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute bottom-0 left-5 top-0 w-px" style={{ background: "var(--color-border)" }} />

          <AnimatePresence mode="popLayout">
            {auditQuery.rows.map((entry, index) => {
              const color = ACTION_COLORS[entry.action_type] || "#7F8C8D";
              const details = entry.new_values || entry.old_values || {};

              return (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: index * 0.03 } }}
                  exit={{ opacity: 0, x: 10 }}
                  className="relative mb-4 ml-12"
                >
                  <StatusIcon actionType={entry.action_type} />

                  <div className="card p-4">
                    <div className="mb-1 flex items-center gap-3">
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                        style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
                      >
                        {entry.action_type.replace(/_/g, " ")}
                      </span>
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: "var(--color-surface-offset)",
                          color: "var(--color-text-faint)",
                        }}
                      >
                        {entry.entity_type}
                      </span>
                      <span className="ml-auto flex items-center gap-1 text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(entry.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-primary)" }}>
                      {JSON.stringify(details)}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {entry.username || "system"}
                      </span>
                      {entry.ip_address && <span>IP: {entry.ip_address}</span>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {auditQuery.rows.length === 0 && (
            <div className="card ml-12 flex flex-col items-center py-12">
              <FileText className="mb-3 h-8 w-8" style={{ color: "var(--color-text-faint)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                No audit entries match your filter.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
