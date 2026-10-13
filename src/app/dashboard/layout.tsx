"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useAppStore } from "@/lib/stores/app-store";
import { type ReactNode } from "react";

const pageTransition = {
  initial: { opacity: 0, x: 12 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    x: -12,
    transition: { duration: 0.15 },
  },
};

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const reducedMotion = useReducedMotion();

  return (
    <div className="dashboard-shell flex h-dvh overflow-hidden" data-sidebar-collapsed={sidebarCollapsed} style={{ background: "var(--color-bg)" }}>
      <a href="#dashboard-content" className="dashboard-skip-link">Skip to content</a>
      {/* Command Palette (Cmd+K) */}
      <CommandPalette />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div
        className="dashboard-main flex min-w-0 flex-1 flex-col overflow-hidden"
      >
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main
          id="dashboard-content"
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
          style={{ paddingTop: "var(--spacing-header)" }}
        >
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                variants={pageTransition}
                // Server rendering cannot know the browser's motion setting.
                // Start visibly on both sides to keep hydration consistent.
                initial={false}
                animate={reducedMotion ? { opacity: 1, x: 0, transition: { duration: 0 } } : "animate"}
                exit={reducedMotion ? { opacity: 1, x: 0, transition: { duration: 0 } } : "exit"}
                className="min-w-0 p-4 sm:p-6"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
