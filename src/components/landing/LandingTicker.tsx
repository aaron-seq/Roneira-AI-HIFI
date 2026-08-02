"use client";

import { useMarketOverviewData } from "@/lib/hooks/use-live-market";
import { formatPercent, formatPrice, getPriceColor } from "@/lib/utils";

const TICKER_SYMBOLS = ["^NSEI", "^BSESN", "^GSPC", "^IXIC", "^DJI", "^NSEBANK"];

export function LandingTicker() {
  const { data, isLoading } = useMarketOverviewData();
  const bySymbol = new Map((data?.data ?? []).map((quote) => [quote.symbol, quote]));
  const quotes = TICKER_SYMBOLS.map((symbol) => bySymbol.get(symbol)).filter(Boolean);

  if (isLoading || quotes.length === 0) {
    return (
      <div className="flex gap-8 overflow-hidden py-3">
        {TICKER_SYMBOLS.map((symbol) => (
          <div key={symbol} className="h-4 w-32 shrink-0 animate-pulse rounded" style={{ background: "var(--color-surface-offset)" }} />
        ))}
      </div>
    );
  }

  const row = quotes.map((quote) => (
    <span key={quote!.symbol} className="flex shrink-0 items-baseline gap-2 px-6 text-sm">
      <span className="ticker text-xs" style={{ color: "var(--color-text-faint)" }}>
        {quote!.name}
      </span>
      <span className="font-mono" data-financial style={{ color: "var(--color-text-primary)" }}>
        {formatPrice(quote!.price)}
      </span>
      <span className={`font-mono text-xs ${getPriceColor(quote!.changePercent)}`} data-financial>
        {formatPercent(quote!.changePercent)}
      </span>
    </span>
  ));

  return (
    <div
      className="overflow-hidden border-y py-3"
      style={{ borderColor: "var(--color-divider)", background: "var(--color-surface)" }}
    >
      <div className="animate-scroll-left flex w-max">
        {row}
        {row}
      </div>
    </div>
  );
}
