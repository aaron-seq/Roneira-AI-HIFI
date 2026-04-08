"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  Bitcoin,
  Gem,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { CardGridSkeleton } from "@/components/ui/Skeletons";
import { useCommoditiesForexData } from "@/lib/hooks/use-live-market";
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
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
};

function QuoteCard({ quote }: { quote: MarketQuote }) {
  const isPositive = quote.changePercent >= 0;

  return (
    <motion.div variants={item} className="card cursor-pointer p-5 transition-all hover:scale-[1.01]">
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background: isPositive
              ? "rgba(46,204,113,0.12)"
              : "rgba(231,76,60,0.12)",
            color: isPositive ? "#2ECC71" : "#E74C3C",
          }}
        >
          {isPositive ? (
            <TrendingUp className="h-5 w-5" />
          ) : (
            <TrendingDown className="h-5 w-5" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {quote.name}
          </p>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>
            {quote.symbol.replace("-USD", "").replace("=X", "").replace("=F", "")}
          </p>
        </div>
      </div>
      <p className="font-mono text-xl font-bold" data-financial style={{ color: "var(--color-text-primary)" }}>
        {formatPrice(quote.price)}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        {isPositive ? (
          <TrendingUp className="h-3.5 w-3.5 text-profit" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-loss" />
        )}
        <span
          className={cn("font-mono text-xs font-semibold", getPriceColor(quote.changePercent))}
          data-financial
        >
          {formatPercent(quote.changePercent)}
        </span>
      </div>
      <p className="mt-2 text-[10px]" style={{ color: "var(--color-text-faint)" }}>
        {quote.exchange} · {quote.provider}
      </p>
    </motion.div>
  );
}

export default function CommoditiesForexPage() {
  const [activeTab, setActiveTab] = useState<"commodities" | "forex" | "crypto">(
    "commodities"
  );
  const marketQuery = useCommoditiesForexData();

  const activeQuotes =
    marketQuery.data?.sections[activeTab] ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          Commodities, Forex & Crypto
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Live prices for metals, energy, currencies, and major digital assets
        </p>
      </div>

      <div className="mb-6 flex items-center gap-1 rounded-lg p-1" style={{ background: "var(--color-surface)" }}>
        {(
          [
            { id: "commodities" as const, label: "Commodities", icon: Gem },
            { id: "forex" as const, label: "Forex", icon: ArrowRightLeft },
            { id: "crypto" as const, label: "Crypto", icon: Bitcoin },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition-colors"
            style={{
              background:
                activeTab === tab.id ? "var(--color-surface-offset)" : "transparent",
              color:
                activeTab === tab.id
                  ? "var(--color-text-primary)"
                  : "var(--color-text-faint)",
            }}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {marketQuery.isLoading ? (
        <CardGridSkeleton count={8} />
      ) : marketQuery.isError ? (
        <div className="card p-6">
          <p style={{ color: "var(--color-text-muted)" }}>
            We couldn&apos;t load commodity and FX data right now.
          </p>
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {activeQuotes.map((quote) => (
            <QuoteCard key={quote.symbol} quote={quote} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
