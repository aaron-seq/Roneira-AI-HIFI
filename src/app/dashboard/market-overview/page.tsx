"use client";

import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Globe,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { CardGridSkeleton } from "@/components/ui/Skeletons";
import { useMarketOverviewData } from "@/lib/hooks/use-live-market";
import type { MarketQuote } from "@/lib/market/types";
import { cn, formatPercent, formatPrice, getPriceColor } from "@/lib/utils";

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

function IndexCard({ quote }: { quote: MarketQuote }) {
  const isPositive = quote.change >= 0;

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
        <div className="mt-1 flex items-center gap-2">
          <span
            className={cn(
              "font-mono text-sm font-medium",
              getPriceColor(quote.change)
            )}
            data-financial
          >
            {quote.change >= 0 ? "+" : ""}
            {formatPrice(quote.change)}
          </span>
          <span
            className={cn(
              "flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-xs font-semibold",
              isPositive ? "bg-profit-subtle text-profit" : "bg-loss-subtle text-loss"
            )}
            data-financial
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {formatPercent(quote.changePercent)}
          </span>
        </div>
      </div>

      <div
        className="mt-4 h-1.5 rounded-full"
        style={{ background: "var(--color-surface-offset)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(8, Math.abs(quote.changePercent) * 12))}%`,
            background: isPositive ? "#2ECC71" : "#E74C3C",
          }}
        />
      </div>
    </motion.div>
  );
}

function MoverRow({ quote }: { quote: MarketQuote }) {
  const isPositive = quote.changePercent >= 0;
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.03]">
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold"
          style={{
            background: isPositive
              ? "rgba(46,204,113,0.12)"
              : "rgba(231,76,60,0.12)",
            color: isPositive ? "#2ECC71" : "#E74C3C",
          }}
        >
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
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
          className={cn("font-mono text-xs font-medium", getPriceColor(quote.changePercent))}
          data-financial
        >
          {formatPercent(quote.changePercent)}
        </p>
      </div>
    </div>
  );
}

export default function MarketOverviewPage() {
  const marketQuery = useMarketOverviewData();

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Market Overview
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Global indices, top movers, and live market breadth refreshed every 60
          seconds
        </p>
      </div>

      {marketQuery.isLoading ? (
        <div className="space-y-6">
          <CardGridSkeleton count={4} />
          <CardGridSkeleton count={4} />
          <CardGridSkeleton count={4} />
          <CardGridSkeleton count={4} />
        </div>
      ) : marketQuery.isError ? (
        <div className="card p-6">
          <p style={{ color: "var(--color-text-muted)" }}>
            Live market data is unavailable right now. Please try again in a
            moment.
          </p>
        </div>
      ) : (
        <>
          <motion.div variants={container} initial="hidden" animate="visible">
            <SectionHeader title="India" icon={Globe} />
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {marketQuery.data?.sections.india.map((quote) => (
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
            <motion.div variants={item} initial="hidden" animate="visible" className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: "#2ECC71" }} />
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
              </div>
            </motion.div>

            <motion.div variants={item} initial="hidden" animate="visible" className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" style={{ color: "#E74C3C" }} />
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
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
