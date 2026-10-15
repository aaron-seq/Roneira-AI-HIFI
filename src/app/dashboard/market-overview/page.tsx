"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Globe,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { CardGridSkeleton } from "@/components/ui/Skeletons";
import { InsightsStories } from "@/components/insights/InsightsStories";
import { useMarketOverviewData, useQuoteHistory } from "@/lib/hooks/use-live-market";
import { buildMarketStories } from "@/lib/insights/stories";
import { MARKET_OVERVIEW_SYMBOLS } from "@/lib/market/constants";
import type { MarketQuote } from "@/lib/market/types";
import { formatPercent, formatPrice } from "@/lib/utils";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

const HERO_SYMBOL = "^NSEI";
const HERO_RANGES = [
  { value: "1month", label: "1M" },
  { value: "3month", label: "3M" },
  { value: "1year", label: "1Y" },
] as const;

// Older stored payloads have no availability flags. Keep their numeric displays,
// while new payloads can explicitly distinguish an unknown change from zero.
function percentAvailable(quote: MarketQuote) {
  return quote.changePercentAvailable !== false && Number.isFinite(quote.changePercent);
}

function changeColor(value: number) {
  return value > 0 ? "var(--color-profit)" : value < 0 ? "var(--color-loss)" : "var(--color-text-muted)";
}

function QuoteMovement({ quote }: { quote: MarketQuote }) {
  const knownChange = quote.changeAvailable !== false && Number.isFinite(quote.change);
  const knownPercent = percentAvailable(quote);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-sm">
      {knownChange && <span data-financial style={{ color: changeColor(quote.change) }}>
        {quote.change > 0 ? "+" : ""}{formatPrice(quote.change)}
      </span>}
      {knownPercent ? <span className="flex items-center gap-1 text-xs font-semibold" data-financial style={{ color: changeColor(quote.changePercent) }}>
        {quote.changePercent > 0 ? <TrendingUp aria-hidden="true" className="h-3 w-3" /> : quote.changePercent < 0 ? <TrendingDown aria-hidden="true" className="h-3 w-3" /> : null}
        {formatPercent(quote.changePercent)}
      </span> : <span className="font-sans text-xs" style={{ color: "var(--color-text-muted)" }}>Change unavailable</span>}
    </div>
  );
}

function SectionHeader({
  title,
  icon: Icon,
}: {
  title: string;
  icon: React.ElementType;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      <Icon className="h-4 w-4" style={{ color: "var(--color-text-faint)" }} />
      <span
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-text-faint)" }}
      >
        {title}
      </span>
    </div>
  );
}

/**
 * The hero index, chosen deliberately rather than reusing a generic
 * "Revenue" card shape: NIFTY 50 as the anchor for an India-first platform,
 * with a real sparkline (daily closes over the selected range) instead of
 * decorative filler. The timeframe pills genuinely refetch a different
 * range via useQuoteHistory -- they aren't static UI.
 */
function HeroIndex({ quote }: { quote: MarketQuote | undefined }) {
  const reducedMotion = useReducedMotion();
  const [range, setRange] = useState<(typeof HERO_RANGES)[number]["value"]>("1month");
  const historyQuery = useQuoteHistory(HERO_SYMBOL, "1day", range);
  const candles = historyQuery.data?.candles ?? [];
  const chartData = candles.map((candle) => ({ time: candle.time, close: candle.close }));
  const strokeColor = quote && percentAvailable(quote) ? changeColor(quote.changePercent) : "var(--color-text-muted)";

  return (
    <motion.div variants={item} className="card mb-6 grid grid-cols-1 gap-6 p-6 lg:grid-cols-[auto_1fr]">
      <div className="min-w-[220px]">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>
          NIFTY 50
        </p>
        {quote ? (
          <>
            <p
              className="mt-2 font-mono text-4xl font-bold"
              data-financial
              style={{ color: "var(--color-text-primary)" }}
            >
              {formatPrice(quote.price)}
            </p>
            <QuoteMovement quote={quote} />
          </>
        ) : (
          <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>Quote unavailable</p>
        )}

        <div className="mt-5 flex gap-1">
          {HERO_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              aria-label={`NIFTY 50 history: ${r.value === "1month" ? "1 month" : r.value === "3month" ? "3 months" : "1 year"}`}
              aria-pressed={range === r.value}
              className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                background: range === r.value ? "var(--color-surface-offset)" : "transparent",
                color: range === r.value ? "var(--color-text-primary)" : "var(--color-text-faint)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-28 min-w-0 lg:h-auto">
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={["dataMin", "dataMax"]} hide />
              <Area
                type="monotone"
                dataKey="close"
                stroke={strokeColor}
                strokeWidth={2}
                fill="url(#heroFill)"
                isAnimationActive={!reducedMotion}
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs" style={{ color: "var(--color-text-faint)" }}>
            {historyQuery.isPending ? "Loading chart..." : "No chart data for this range"}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function IndexCard({ quote }: { quote: MarketQuote }) {
  const knownPercent = percentAvailable(quote);

  return (
    <motion.div variants={item} className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {quote.name}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="ticker text-[10px]">{quote.symbol.replace("^", "")}</span>
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold"
              style={{
                background: "var(--color-surface-offset)",
                color: "var(--color-text-faint)",
              }}
            >
              {quote.exchange}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p
          className="font-mono text-xl font-bold"
          style={{ color: "var(--color-text-primary)" }}
          data-financial
        >
          {formatPrice(quote.price)}
        </p>
        <QuoteMovement quote={quote} />
      </div>

      <div
        className="mt-4 h-1.5 rounded-full"
        style={{ background: "var(--color-surface-offset)" }}
      >
        {knownPercent && <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.abs(quote.changePercent) * 12)}%`,
            background: changeColor(quote.changePercent),
          }}
        />}
      </div>
    </motion.div>
  );
}

function MoverRow({ quote }: { quote: MarketQuote }) {
  const knownPercent = percentAvailable(quote);
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.03]">
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold"
          style={{
            background: "var(--color-surface-offset)",
            color: knownPercent ? changeColor(quote.changePercent) : "var(--color-text-muted)",
          }}
        >
          {knownPercent && quote.changePercent > 0 ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : knownPercent && quote.changePercent < 0 ? (
            <TrendingDown className="h-3.5 w-3.5" />
          ) : <Activity aria-hidden="true" className="h-3.5 w-3.5" />}
        </div>
        <div>
          <p className="ticker text-xs">{quote.symbol.replace(".NS", "")}</p>
          <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            {quote.name}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p
          className="font-mono text-sm font-medium"
          data-financial
          style={{ color: "var(--color-text-primary)" }}
        >
          {formatPrice(quote.price)}
        </p>
        <p
          className="font-mono text-xs font-medium"
          data-financial
          style={{ color: knownPercent ? changeColor(quote.changePercent) : "var(--color-text-muted)" }}
        >
          {knownPercent ? formatPercent(quote.changePercent) : "Change unavailable"}
        </p>
      </div>
    </div>
  );
}

export default function MarketOverviewPage() {
  const marketQuery = useMarketOverviewData();
  const allQuotes = marketQuery.data?.data ?? [];
  const insights = buildMarketStories({ configs: MARKET_OVERVIEW_SYMBOLS, quotes: allQuotes });
  const heroQuote = allQuotes.find((quote) => quote.symbol === HERO_SYMBOL);
  const indiaRest = (marketQuery.data?.sections.india ?? []).filter(
    (quote) => quote.symbol !== HERO_SYMBOL
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-3xl leading-tight"
            style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", color: "var(--color-text-primary)" }}
          >
            Market Overview
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Tracked index snapshots and stock movers. Quotes refresh every 60 seconds; provider sessions may differ.
          </p>
        </div>
      </div>

      <InsightsStories title="Market insights" insights={insights}
        state={marketQuery.isPending ? "loading" : marketQuery.isError ? "error" : "ready"}
        onRetry={() => { void marketQuery.refetch(); }} isRetrying={marketQuery.isFetching}
        errorMessage="Market quotes could not be refreshed. Retry to load the tracked instruments." />

      {marketQuery.isPending ? (
        <div className="space-y-6">
          <CardGridSkeleton count={4} />
          <CardGridSkeleton count={4} />
          <CardGridSkeleton count={4} />
          <CardGridSkeleton count={4} />
        </div>
      ) : !marketQuery.isError || marketQuery.data ? (
        <>
          <HeroIndex quote={heroQuote} />

          <motion.div variants={container} initial={false} animate="visible">
            <SectionHeader title="India" icon={Globe} />
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {indiaRest.map((quote) => (
                <IndexCard key={quote.symbol} quote={quote} />
              ))}
            </div>

            <SectionHeader title="United States" icon={BarChart3} />
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {marketQuery.data?.sections.us.map((quote) => (
                <IndexCard key={quote.symbol} quote={quote} />
              ))}
            </div>

            <SectionHeader title="Europe" icon={Globe} />
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {marketQuery.data?.sections.europe.map((quote) => (
                <IndexCard key={quote.symbol} quote={quote} />
              ))}
            </div>

            <SectionHeader title="Special Indicators" icon={Activity} />
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {marketQuery.data?.sections.special.map((quote) => (
                <IndexCard key={quote.symbol} quote={quote} />
              ))}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <motion.div variants={item} initial={false} animate="visible" className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: "var(--color-profit)" }} />
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Top Gainers
                </h3>
              </div>
              <div className="space-y-1">
                {marketQuery.data?.movers.gainers.map((quote) => (
                  <MoverRow key={quote.symbol} quote={quote} />
                ))}
                {marketQuery.data && marketQuery.data.movers.gainers.length === 0 && (
                  <p className="px-3 py-2 text-xs" style={{ color: "var(--color-text-faint)" }}>
                    No gainers are reported in the tracked stock snapshot.
                  </p>
                )}
              </div>
            </motion.div>

            <motion.div variants={item} initial={false} animate="visible" className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" style={{ color: "var(--color-loss)" }} />
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Top Losers
                </h3>
              </div>
              <div className="space-y-1">
                {marketQuery.data?.movers.losers.map((quote) => (
                  <MoverRow key={quote.symbol} quote={quote} />
                ))}
                {marketQuery.data && marketQuery.data.movers.losers.length === 0 && (
                  <p className="px-3 py-2 text-xs" style={{ color: "var(--color-text-faint)" }}>
                    No losers are reported in the tracked stock snapshot.
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </div>
  );
}
