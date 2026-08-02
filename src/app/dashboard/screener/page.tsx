"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { TableSkeleton } from "@/components/ui/Skeletons";
import { useStockScreener } from "@/lib/hooks/use-live-market";
import type { ScreenerRow } from "@/lib/market/types";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "all", label: "All" },
  { key: "large_cap_strong", label: "Large Cap · Strong" },
  { key: "mid_cap_strong", label: "Mid Cap · Strong" },
  { key: "small_cap_strong", label: "Small Cap · Strong" },
  { key: "dividend_payers", label: "Dividend Payers" },
  { key: "undervalued_growth", label: "Undervalued Growth" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const SIGNAL_TONE: Record<string, string> = {
  STRONG_BUY: "var(--color-profit)",
  BUY: "var(--color-buy)",
  HOLD: "var(--color-warning)",
  SELL: "var(--color-sell)",
  STRONG_SELL: "var(--color-loss)",
};

function fmt(value: number | null | undefined, digits = 2): string {
  return value == null ? "—" : value.toFixed(digits);
}

function fmtPct(value: number | null | undefined): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function fmtCap(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1e12) return `₹${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `₹${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(1)}Cr`;
  return value.toLocaleString();
}

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
};

export default function ScreenerPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useStockScreener();
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");

  const rows: ScreenerRow[] = useMemo(() => {
    const base = data?.[tab] ?? [];
    if (!search.trim()) return base;
    const needle = search.trim().toLowerCase();
    return base.filter(
      (row) =>
        row.ticker.toLowerCase().includes(needle) ||
        (row.longName ?? "").toLowerCase().includes(needle) ||
        (row.sector ?? "").toLowerCase().includes(needle)
    );
  }, [data, tab, search]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-3xl leading-tight"
            style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", color: "var(--color-text-primary)" }}
          >
            Stock screener
          </h1>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--color-text-muted)" }}>
            Live fundamentals via yfinance for a 42-ticker NSE starter universe, screened on
            disclosed objective criteria — not investment advice, and not a claim about
            management quality or government exposure that this data can&apos;t back.
          </p>
        </div>
        {data?.generated_at && (
          <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
            Updated {new Date(data.generated_at + "Z").toLocaleTimeString()}
          </p>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: tab === t.key ? "var(--color-brass-dim)" : "var(--color-surface-offset)",
              color: tab === t.key ? "var(--color-brass-bright)" : "var(--color-text-muted)",
              border: `1px solid ${tab === t.key ? "rgba(200,146,47,0.3)" : "var(--color-border)"}`,
            }}
          >
            {t.label}
          </button>
        ))}

        <div className="relative ml-auto w-full max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--color-text-faint)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by ticker, name, sector..."
            className="w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>
      </div>

      {isLoading && <TableSkeleton rows={10} />}

      {isError && (
        <div className="card p-6 text-sm" style={{ color: "var(--color-loss)" }}>
          Couldn&apos;t load screener data. The ML service may be cold-starting a live fetch
          across 42 tickers, which can take up to a minute the first time — try again shortly.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-divider)" }}>
                {["Stock", "Sector", "P/E", "ROE / Margin", "Div Yield", "PEG", "Mkt Cap", "Technical"].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const tone = SIGNAL_TONE[row.technical_signal ?? ""] ?? "var(--color-text-muted)";
                const quality = row.returnOnEquity ?? row.profitMargins;
                return (
                  <motion.tr
                    key={row.ticker}
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{ duration: 0.25, delay: Math.min(index, 12) * 0.02 }}
                    onClick={() => router.push(`/dashboard/predict?ticker=${encodeURIComponent(row.ticker)}`)}
                    className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                    style={{ borderBottom: "1px solid var(--color-divider)" }}
                  >
                    <td className="px-4 py-3">
                      <p className="ticker text-xs">{row.ticker}</p>
                      <p className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {row.longName ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {row.sector ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" data-financial style={{ color: "var(--color-text-primary)" }}>
                      {fmt(row.trailingPE)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" data-financial style={{ color: "var(--color-text-primary)" }}>
                      {fmtPct(quality)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" data-financial style={{ color: "var(--color-text-primary)" }}>
                      {row.dividendYield == null ? "—" : `${row.dividendYield.toFixed(2)}%`}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" data-financial style={{ color: "var(--color-text-primary)" }}>
                      {fmt(row.pegRatio)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" data-financial style={{ color: "var(--color-text-muted)" }}>
                      {fmtCap(row.marketCap)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase")}
                        style={{ background: `${tone}22`, color: tone }}
                      >
                        {row.technical_signal ?? "—"}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: "var(--color-text-faint)" }}>
                    No stocks match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
