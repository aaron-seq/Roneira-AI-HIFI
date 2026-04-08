"use client";

import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Brain,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Server,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAdminOverview } from "@/lib/hooks/use-admin-overview";

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
};

function StatusDot({ healthy }: { healthy: boolean }) {
  const color = healthy ? "#2ECC71" : "#E74C3C";
  return (
    <span className="relative flex h-2 w-2">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
        style={{ background: color }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

export default function AdminPage() {
  const overviewQuery = useAdminOverview();
  const health = overviewQuery.data?.mlHealth;
  const modelsLoaded = health?.models_loaded
    ? Object.values(health.models_loaded).filter(Boolean).length
    : 0;
  const totalModels = health?.models_loaded
    ? Object.keys(health.models_loaded).length
    : 0;

  const metrics = [
    {
      label: "ML Backend",
      value: health?.status || "Unavailable",
      healthy: health?.status === "healthy",
      icon: Brain,
    },
    {
      label: "Database",
      value: "Supabase",
      healthy: true,
      icon: Database,
    },
    {
      label: "Registered Users",
      value: String(overviewQuery.data?.userCount ?? 0),
      healthy: true,
      icon: Users,
    },
    {
      label: "Predictions Logged",
      value: String(overviewQuery.data?.predictionCount ?? 0),
      healthy: true,
      icon: BarChart3,
    },
    {
      label: "Admin Accounts",
      value: String(overviewQuery.data?.adminCount ?? 0),
      healthy: true,
      icon: Shield,
    },
    {
      label: "Models Loaded",
      value: totalModels ? `${modelsLoaded}/${totalModels}` : "0/0",
      healthy: totalModels > 0 && modelsLoaded === totalModels,
      icon: Cpu,
    },
    {
      label: "Cache Strategy",
      value: "Next + ML TTL",
      healthy: true,
      icon: HardDrive,
    },
    {
      label: "Inference Surface",
      value: "Next -> FastAPI",
      healthy: true,
      icon: Zap,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Admin Panel
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Read-only launch diagnostics for users, audit activity, and ML health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot healthy={health?.status === "healthy"} />
          <span className="text-xs font-medium" style={{ color: health?.status === "healthy" ? "#2ECC71" : "#E74C3C" }}>
            {health?.status === "healthy" ? "Operational" : "Needs Attention"}
          </span>
        </div>
      </div>

      {overviewQuery.isLoading ? (
        <div className="card p-6">
          <p style={{ color: "var(--color-text-muted)" }}>Loading admin overview...</p>
        </div>
      ) : overviewQuery.isError ? (
        <div className="card p-6">
          <p style={{ color: "var(--color-text-muted)" }}>
            Admin overview is unavailable. Confirm you are signed in as an admin and that the migration set is applied.
          </p>
        </div>
      ) : (
        <>
          <motion.div variants={container} initial="hidden" animate="visible" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <motion.div key={metric.label} variants={item} className="card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <Icon className="h-5 w-5" style={{ color: "var(--color-info)" }} />
                    <StatusDot healthy={metric.healthy} />
                  </div>
                  <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                    {metric.label}
                  </p>
                  <p className="mt-1 text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                    {metric.value}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
            <div className="card overflow-hidden">
              <div className="border-b px-5 py-4" style={{ borderColor: "var(--color-divider)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Recent Users
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-divider)", background: "var(--color-surface-2)" }}>
                      <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewQuery.data?.recentUsers.map((user) => (
                      <tr key={user.id} style={{ borderBottom: "1px solid var(--color-divider)" }} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                              {user.username}
                            </p>
                            <p className="text-[11px]" style={{ color: "var(--color-text-faint)" }}>
                              {user.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{
                              background: user.role === "admin" ? "rgba(155,89,182,0.12)" : "rgba(52,152,219,0.12)",
                              color: user.role === "admin" ? "#9B59B6" : "#3498DB",
                            }}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                          {formatDistanceToNow(new Date(user.created_at), {
                            addSuffix: true,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b px-5 py-4" style={{ borderColor: "var(--color-divider)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Recent Audit Activity
                </h3>
              </div>
              <div className="space-y-1 p-4">
                {overviewQuery.data?.recentAudit.map((entry) => (
                  <div key={entry.id} className="rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.03]">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5" style={{ color: "var(--color-info)" }} />
                      <p className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {entry.action_type.replace(/_/g, " ")}
                      </p>
                      <span className="ml-auto flex items-center gap-1 text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(entry.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                      {entry.entity_type}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card mt-6 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Server className="h-4 w-4" style={{ color: "var(--color-info)" }} />
              <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                FastAPI Health Payload
              </h3>
            </div>
            <pre className="overflow-x-auto rounded-lg p-4 text-xs" style={{ background: "var(--color-bg)", color: "var(--color-text-muted)" }}>
              {JSON.stringify(overviewQuery.data?.mlHealth, null, 2)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
