"use client";

import { useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Brain, Star, DollarSign, Briefcase, Newspaper, FileText,
  Shield, ChevronLeft, ChevronRight, ListFilter, X,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { useAppStore } from "@/lib/stores/app-store";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Market Overview", href: "/dashboard/market-overview", icon: BarChart3 },
  { label: "AI Prediction", href: "/dashboard/predict", icon: Brain },
  { label: "Watchlist", href: "/dashboard/watchlist", icon: Star },
  { label: "Screener", href: "/dashboard/screener", icon: ListFilter },
  { label: "Commodities & Forex", href: "/dashboard/commodities-forex", icon: DollarSign },
  { label: "Portfolio", href: "/dashboard/portfolio", icon: Briefcase },
  { label: "News Feed", href: "/dashboard/news", icon: Newspaper },
  { label: "Audit Log", href: "/dashboard/audit-log", icon: FileText },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useAppStore();
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), [setMobileSidebarOpen]);

  // A drawer opened on a phone must not leave the desktop inert when resized.
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (media.matches) closeMobileSidebar();
    };
    closeOnDesktop();
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, [closeMobileSidebar]);

  return (
    <>
      <aside className="dashboard-desktop-sidebar fixed left-0 top-0 z-40 flex flex-col border-r">
        <SidebarContent collapsed={sidebarCollapsed} navId="desktop-navigation" />
        <div className="border-t p-3" style={{ borderColor: "var(--color-border)" }}>
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex min-h-10 w-full items-center justify-center rounded-lg p-2 transition-colors hover:bg-white/5"
            aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            aria-controls="desktop-navigation"
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? <ChevronRight aria-hidden="true" className="h-4 w-4" /> : <ChevronLeft aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <Dialog
        open={mobileSidebarOpen}
        onClose={closeMobileSidebar}
        labelledBy="mobile-navigation-title"
        className="dashboard-mobile-panel absolute inset-y-0 left-0 m-0 flex h-dvh w-72 max-w-[calc(100vw-3rem)] max-h-none flex-col rounded-none border-0 border-r p-0"
      >
        <div className="flex min-h-16 items-center justify-between gap-2 border-b px-4" style={{ borderColor: "var(--color-border)" }}>
          <h2 id="mobile-navigation-title" className="text-sm font-semibold">Navigation</h2>
          <button
            type="button"
            data-dialog-autofocus
            onClick={closeMobileSidebar}
            aria-label="Close navigation"
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/5"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent collapsed={false} navId="mobile-navigation" onNavigate={closeMobileSidebar} />
      </Dialog>
    </>
  );
}

function SidebarContent({ collapsed, navId, onNavigate }: {
  collapsed: boolean;
  navId: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isAdmin = useAppStore((state) => state.user?.role === "admin");
  const items = isAdmin
    ? [...navItems, { label: "Admin Panel", href: "/dashboard/admin", icon: Shield }]
    : navItems;

  return (
    <>
      <div className="flex min-h-16 items-center gap-3 border-b px-4" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black">
          <Image src="/roneira-mark.png" alt="" width={20} height={20} className="h-5 w-5" priority />
        </div>
        {!collapsed && <div>
          <p className="text-sm font-bold">Roneira AI</p>
          <p className="text-[10px] leading-none" style={{ color: "var(--color-text-muted)" }}>HIFI Platform</p>
        </div>}
      </div>
      <nav id={navId} aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                onClick={onNavigate}
                className={cn("dashboard-nav-link relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium", collapsed && "justify-center px-2")}
                style={{
                  color: isActive ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  background: isActive ? "var(--color-surface-offset)" : undefined,
                }}
              >
                {isActive && <span aria-hidden="true" className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-info" />}
                <item.icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
