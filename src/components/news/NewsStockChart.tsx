"use client";

import { useRouter } from "next/navigation";
import { Sparkline } from "@/components/shared/Sparkline";
import { useQuoteHistory } from "@/lib/hooks/use-live-market";
import { cn, formatPercent, getPriceColor } from "@/lib/utils";

/**
 * Compact real chart for a news article confidently matched to a known
 * stock (see matchKnownStock in lib/news/classify.ts -- deliberately
 * stricter than the loose relatedTickers extraction, specifically because
 * this component puts a chart next to the claim). One month of daily
 * closes via the same history endpoint the rest of the app uses; TanStack
 * Query dedupes identical symbols across multiple articles automatically.
 */
export function NewsStockChart({ symbol }: { symbol: string }) {
  const router = useRouter();
  const historyQuery = useQuoteHistory(symbol, "1day", "1month");
  const candles = historyQuery.data?.candles ?? [];

  if (historyQuery.isLoading) {
    return (
      <div className="h-14 w-28 animate-pulse rounded-md" style={{ background: "var(--color-surface-offset)" }} />
    );
  }

  if (candles.length < 2) {
    return null;
  }

  const first = candles[0].close;
  const last = candles[candles.length - 1].close;
  const changePercent = ((last - first) / first) * 100;

  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        router.push(`/dashboard/predict?ticker=${encodeURIComponent(symbol)}`);
      }}
      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <Sparkline symbol={symbol} className="h-9 w-16 shrink-0" />
      <div>
        <p className="ticker text-[10px]" style={{ color: "var(--color-text-primary)" }}>
          {symbol.replace(".NS", "")}
        </p>
        <p className={cn("font-mono text-[10px] font-semibold", getPriceColor(changePercent))} data-financial>
          {formatPercent(changePercent)} · 1M
        </p>
      </div>
    </button>
  );
}
