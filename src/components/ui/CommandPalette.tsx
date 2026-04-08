"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  BarChart2,
  Brain,
  Star,
  Briefcase,
  Newspaper,
  ShoppingCart,
  FileText,
  Settings,
  ArrowRight,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  category: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const items: SearchItem[] = [
    { id: "market", label: "Market Overview", description: "View global indices & top movers", icon: BarChart2, action: () => router.push("/dashboard/market-overview"), category: "Navigation" },
    { id: "predict", label: "AI Prediction Tool", description: "Run ML predictions on any stock", icon: Brain, action: () => router.push("/dashboard/predict"), category: "Navigation" },
    { id: "watchlist", label: "Watchlist", description: "View tracked stocks & alerts", icon: Star, action: () => router.push("/dashboard/watchlist"), category: "Navigation" },
    { id: "portfolio", label: "Portfolio", description: "View holdings & P&L", icon: Briefcase, action: () => router.push("/dashboard/portfolio"), category: "Navigation" },
    { id: "news", label: "News Feed", description: "Global & India market news", icon: Newspaper, action: () => router.push("/dashboard/news"), category: "Navigation" },
    { id: "commodities", label: "Commodities & Forex", description: "Gold, Oil, Crypto, Currency pairs", icon: ShoppingCart, action: () => router.push("/dashboard/commodities-forex"), category: "Navigation" },
    { id: "audit", label: "Audit Log", description: "View all user actions", icon: FileText, action: () => router.push("/dashboard/audit-log"), category: "Navigation" },
    { id: "settings", label: "Settings", description: "Account & preferences", icon: Settings, action: () => router.push("/dashboard/settings"), category: "Navigation" },
    // Quick Actions
    { id: "predict-aapl", label: "Predict AAPL", description: "Run AI prediction on Apple", icon: Brain, action: () => { router.push("/dashboard/predict"); }, category: "Quick Actions" },
    { id: "predict-reliance", label: "Predict RELIANCE", description: "Run AI prediction on Reliance", icon: Brain, action: () => { router.push("/dashboard/predict"); }, category: "Quick Actions" },
    { id: "predict-tsla", label: "Predict TSLA", description: "Run AI prediction on Tesla", icon: Brain, action: () => { router.push("/dashboard/predict"); }, category: "Quick Actions" },
  ];

  const filtered = items.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.description?.toLowerCase().includes(query.toLowerCase())
  );

  const grouped = filtered.reduce(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, SearchItem[]>
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelected(0);
    }
  }, [open]);

  // Arrow keys + Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filtered[selected]) {
        filtered[selected].action();
        setOpen(false);
      }
    },
    [filtered, selected]
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.96, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="glass w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--color-divider)" }}>
              <Search className="h-5 w-5 shrink-0" style={{ color: "var(--color-text-faint)" }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Search pages, actions, stocks..."
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--color-text-primary)" }}
              />
              <kbd
                className="hidden rounded px-2 py-0.5 text-[10px] font-medium sm:block"
                style={{ background: "var(--color-surface-offset)", color: "var(--color-text-faint)", border: "1px solid var(--color-border)" }}
              >
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto p-2">
              {Object.entries(grouped).map(([category, categoryItems]) => (
                <div key={category} className="mb-2">
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>
                    {category}
                  </p>
                  {categoryItems.map((item) => {
                    const globalIdx = filtered.indexOf(item);
                    const isActive = globalIdx === selected;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                        )}
                        onClick={() => {
                          item.action();
                          setOpen(false);
                        }}
                        onMouseEnter={() => setSelected(globalIdx)}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: isActive ? "var(--color-info)" : "var(--color-surface-offset)" }}
                        >
                          <Icon className="h-4 w-4" style={{ color: isActive ? "white" : "var(--color-text-muted)" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                            {item.label}
                          </p>
                          {item.description && (
                            <p className="text-[11px] truncate" style={{ color: "var(--color-text-faint)" }}>
                              {item.description}
                            </p>
                          )}
                        </div>
                        {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-faint)" }} />}
                      </button>
                    );
                  })}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center py-8">
                  <Search className="mb-2 h-8 w-8" style={{ color: "var(--color-text-faint)" }} />
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No results for &quot;{query}&quot;</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-5 py-3 text-[10px]" style={{ borderTop: "1px solid var(--color-divider)", color: "var(--color-text-faint)" }}>
              <span className="flex items-center gap-1">
                <kbd className="rounded px-1.5 py-0.5" style={{ background: "var(--color-surface-offset)", border: "1px solid var(--color-border)" }}>↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded px-1.5 py-0.5" style={{ background: "var(--color-surface-offset)", border: "1px solid var(--color-border)" }}>↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded px-1.5 py-0.5" style={{ background: "var(--color-surface-offset)", border: "1px solid var(--color-border)" }}>Esc</kbd>
                Close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
