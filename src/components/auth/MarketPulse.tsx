"use client";

import { useMarketOverviewData } from "@/lib/hooks/use-live-market";
import { formatPercent, formatPrice, getPriceColor } from "@/lib/utils";

/**
 * Real quotes for the login/signup brand panel -- not decorative filler.
 * Same overview endpoint the dashboard uses, so a visitor sees the actual
 * thing this product does before they've even signed in.
 */
const PULSE_SYMBOLS = ["^NSEI", "^BSESN", "^GSPC", "^IXIC", "^DJI"];

export function MarketPulse() {
  const { data, isLoading } = useMarketOverviewData();
  const bySymbol = new Map((data?.data ?? []).map((quote) => [quote.symbol, quote]));
  const quotes = PULSE_SYMBOLS.map((symbol) => bySymbol.get(symbol)).filter(Boolean);

  if (isLoading || quotes.length === 0) {
    return (
      <div className="space-y-2.5">
        {PULSE_SYMBOLS.slice(0, 4).map((symbol) => (
          <div key={symbol} className="flex items-center justify-between">
            <div className="h-3 w-20 rounded" style={{ background: "var(--color-surface-offset)" }} />
            <div className="h-3 w-16 rounded" style={{ background: "var(--color-surface-offset)" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {quotes.map((quote) => (
        <div key={quote!.symbol} className="flex items-baseline justify-between gap-4">
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {quote!.name}
          </span>
          <span className="flex items-baseline gap-2 font-mono text-sm" data-financial>
            <span style={{ color: "var(--color-text-primary)" }}>{formatPrice(quote!.price)}</span>
            <span className={getPriceColor(quote!.changePercent)}>
              {formatPercent(quote!.changePercent)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
