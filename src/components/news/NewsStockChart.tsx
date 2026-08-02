"use client";

import { useRouter } from "next/navigation";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
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
  const isPositive = changePercent >= 0;
  const strokeColor = isPositive ? "#2ECC71" : "#E74C3C";
  const chartData = candles.map((candle) => ({ close: candle.close }));

  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        router.push(`/dashboard/predict?ticker=${encodeURIComponent(symbol)}`);
      }}
      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <div className="h-9 w-16 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <defs>
              <linearGradient id={`newsSpark-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="close"
              stroke={strokeColor}
              strokeWidth={1.5}
              fill={`url(#newsSpark-${symbol})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
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
