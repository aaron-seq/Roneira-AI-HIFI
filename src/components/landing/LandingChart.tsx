"use client";

import { useEffect, useRef, useState } from "react";
import { ColorType, createChart, type IChartApi, type Time } from "lightweight-charts";
import { motion } from "framer-motion";
import { useQuoteHistory } from "@/lib/hooks/use-live-market";
import { formatPercent, formatPrice, getPriceColor } from "@/lib/utils";

// getTickerCurrency() only recognises the .NS/.BO equity suffix, not index
// symbols like ^NSEI -- so currency is declared per-symbol here instead of
// inferred from the ticker string, the same way MarketQuote.currency is
// sourced from static config rather than guessed client-side.
const SYMBOLS = [
  { symbol: "^NSEI", label: "NIFTY 50", currency: "INR" },
  { symbol: "^GSPC", label: "S&P 500", currency: "USD" },
  { symbol: "AAPL", label: "Apple", currency: "USD" },
  { symbol: "NVDA", label: "NVIDIA", currency: "USD" },
  { symbol: "RELIANCE.NS", label: "Reliance", currency: "INR" },
  { symbol: "TCS.NS", label: "TCS", currency: "INR" },
] as const;

const RANGES = [
  { range: "1month", interval: "1day", label: "1M" },
  { range: "6month", interval: "1day", label: "6M" },
  { range: "1year", interval: "1week", label: "1Y" },
] as const;

function toChartTime(value: string): Time {
  return Math.floor(new Date(value).getTime() / 1000) as Time;
}

export function LandingChart() {
  const [symbol, setSymbol] = useState<(typeof SYMBOLS)[number]["symbol"]>("^NSEI");
  const [rangeIndex, setRangeIndex] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const activeRange = RANGES[rangeIndex];
  const historyQuery = useQuoteHistory(symbol, activeRange.interval, activeRange.range);

  useEffect(() => {
    if (!containerRef.current || !historyQuery.data?.candles?.length) {
      return;
    }

    const styles = getComputedStyle(document.documentElement);
    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 380,
      layout: {
        background: {
          type: ColorType.Solid,
          color: styles.getPropertyValue("--color-bg").trim() || "#0A0C13",
        },
        textColor: styles.getPropertyValue("--color-text-muted").trim() || "#838BA0",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)" },
      crosshair: { mode: 0 },
    });

    const areaSeries = chart.addAreaSeries({
      lineColor: "#C8922F",
      topColor: "rgba(200, 146, 47, 0.28)",
      bottomColor: "rgba(200, 146, 47, 0.02)",
      lineWidth: 2,
    });

    areaSeries.setData(
      historyQuery.data.candles.map((candle) => ({
        time: toChartTime(candle.time),
        value: candle.close,
      }))
    );

    chart.timeScale().fitContent();
    chartRef.current = chart;

    return () => {
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [historyQuery.data?.candles]);

  const candles = historyQuery.data?.candles;
  const latest = candles?.[candles.length - 1];
  const first = candles?.[0];
  const periodChangePercent =
    latest && first && first.close !== 0
      ? ((latest.close - first.close) / first.close) * 100
      : 0;
  const currency = SYMBOLS.find((item) => item.symbol === symbol)?.currency ?? "USD";

  return (
    <div
      className="card overflow-hidden p-5 sm:p-6"
      style={{ boxShadow: "var(--shadow-elevated)" }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5">
          {SYMBOLS.map((item) => (
            <button
              key={item.symbol}
              onClick={() => setSymbol(item.symbol)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200"
              style={{
                background: symbol === item.symbol ? "var(--color-brass-dim)" : "transparent",
                color: symbol === item.symbol ? "var(--color-brass-bright)" : "var(--color-text-muted)",
                border: `1px solid ${symbol === item.symbol ? "rgba(200,146,47,0.4)" : "var(--color-border)"}`,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-full p-1" style={{ background: "var(--color-surface-2)" }}>
          {RANGES.map((item, index) => (
            <button
              key={item.range}
              onClick={() => setRangeIndex(index)}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200"
              style={{
                background: rangeIndex === index ? "var(--color-info)" : "transparent",
                color: rangeIndex === index ? "#FFFFFF" : "var(--color-text-muted)",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {latest && (
        <motion.div
          key={`${symbol}-${latest.close}`}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-baseline gap-3"
        >
          <span className="font-mono text-2xl font-semibold sm:text-3xl" data-financial style={{ color: "var(--color-text-primary)" }}>
            {currency === "INR" ? "₹" : "$"}
            {formatPrice(latest.close)}
          </span>
          <span className={`font-mono text-sm font-semibold ${getPriceColor(periodChangePercent)}`} data-financial>
            {formatPercent(periodChangePercent)}
          </span>
          <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
            over {activeRange.label}
          </span>
        </motion.div>
      )}

      {historyQuery.isLoading && (
        <div className="flex h-[380px] w-full items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--color-brass)", borderTopColor: "transparent" }}
          />
        </div>
      )}

      {historyQuery.isError && (
        <div className="flex h-[380px] w-full items-center justify-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          Live chart data is temporarily unavailable.
        </div>
      )}

      <div ref={containerRef} className="h-[380px] w-full" style={{ display: historyQuery.data?.candles?.length ? "block" : "none" }} />
    </div>
  );
}
