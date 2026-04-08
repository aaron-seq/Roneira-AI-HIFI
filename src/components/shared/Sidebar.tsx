"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  Brain,
  Star,
  DollarSign,
  Briefcase,
  Newspaper,
  FileText,
  Shield,
  ChevronLeft,
  ChevronRight,
  Activity,
} from "lucide-react";
import { useAppStore } from "@/lib/stores/app-store";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Market Overview",
    href: "/dashboard/market-overview",
    icon: BarChart3,
  },
  {
    label: "AI Prediction",
    href: "/dashboard/predict",
    icon: Brain,
  },
  {
    label: "Watchlist",
    href: "/dashboard/watchlist",
    icon: Star,
  },
  {
    label: "Commodities & Forex",
    href: "/dashboard/commodities-forex",
    icon: DollarSign,
  },
  {
    label: "Portfolio",
    href: "/dashboard/portfolio",
    icon: Briefcase,
  },
  {
    label: "News Feed",
    href: "/dashboard/news",
    icon: Newspaper,
  },
  {
    label: "Audit Log",
    href: "/dashboard/audit-log",
    icon: FileText,
  },
];

const adminItems = [
  {
    label: "Admin Panel",
    href: "/dashboard/admin",
    icon: Shield,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, user } = useAppStore();
  const isAdmin = user?.role === "admin";

  return (
    <motion.aside
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        width: sidebarCollapsed ? "var(--spacing-sidebar-collapsed)" : "var(--spacing-sidebar)",
      }}
      animate={{
        width: sidebarCollapsed ? 68 : 260,
      }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-4" style={{ borderColor: "var(--color-border)" }}>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "linear-gradient(135deg, #3498DB 0%, #9B59B6 100%)" }}
        >
          <Activity className="h-5 w-5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <p className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>
              Roneira AI
            </p>
            <p className="text-[10px] leading-none" style={{ color: "var(--color-text-faint)" }}>
              HIFI Platform
            </p>
          </motion.div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  sidebarCollapsed && "justify-center px-2",
                )}
                style={{
                  color: isActive ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  background: isActive ? "var(--color-surface-offset)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)";
                  }
                }}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                    style={{ background: "#3498DB" }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}

                <item.icon className="h-[18px] w-[18px] shrink-0" />

                {!sidebarCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}

                {/* Tooltip for collapsed state */}
                {sidebarCollapsed && (
                  <div className="pointer-events-none absolute left-full ml-2 hidden rounded-md px-2 py-1 text-xs font-medium opacity-0 shadow-lg transition-opacity group-hover:block group-hover:opacity-100" style={{ background: "var(--color-surface-2)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--color-divider)" }}>
            {!sidebarCollapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>
                Admin
              </p>
            )}
            {adminItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    sidebarCollapsed && "justify-center px-2"
                  )}
                  style={{
                    color: isActive ? "#F39C12" : "var(--color-text-muted)",
                    background: isActive ? "rgba(243, 156, 18, 0.1)" : "transparent",
                  }}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t p-3" style={{ borderColor: "var(--color-border)" }}>
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center rounded-lg p-2 transition-colors hover:bg-white/5"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          ) : (
            <ChevronLeft className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          )}
        </button>
      </div>
    </motion.aside>
  );
}
