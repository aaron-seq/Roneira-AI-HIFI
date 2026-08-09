"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useQuoteHistory } from "@/lib/hooks/use-live-market";

interface SparklineProps {
  symbol: string;
  className?: string;
}

/**
 * Compact real 1-month sparkline, shared by Watchlist, Commodities/Forex,
 * and NewsStockChart. Renders nothing (not a loading skeleton) below 2
 * candles so callers can lay it out inline without reserving dead space
 * for symbols with no history yet.
 */
export function Sparkline({ symbol, className }: SparklineProps) {
  const historyQuery = useQuoteHistory(symbol, "1day", "1month");
  const candles = historyQuery.data?.candles ?? [];

  if (candles.length < 2) {
    return null;
  }

  const first = candles[0].close;
  const last = candles[candles.length - 1].close;
  const isPositive = last - first >= 0;
  const strokeColor = isPositive ? "#2ECC71" : "#E74C3C";
  const chartData = candles.map((candle) => ({ close: candle.close }));
  const gradientId = `spark-${symbol.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="close"
            stroke={strokeColor}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
