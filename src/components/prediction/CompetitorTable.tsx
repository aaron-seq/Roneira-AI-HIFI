"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { usePeerComparison } from "@/lib/hooks/use-live-market";
import { cn, formatPercent, formatPrice, getPriceColor } from "@/lib/utils";

interface CompetitorTableProps {
  ticker: string;
  sector?: string | null;
}

function getSignal(changePercent: number) {
  if (changePercent >= 2) return "BUY";
  if (changePercent <= -2) return "SELL";
  return "HOLD";
}

function getSignalColor(signal: string) {
  switch (signal) {
    case "BUY":
      return "#2ECC71";
    case "SELL":
      return "#E74C3C";
    default:
      return "#F39C12";
  }
}

export function CompetitorTable({ ticker, sector }: CompetitorTableProps) {
  const peerQuery = usePeerComparison(ticker);

  if (peerQuery.isLoading) {
    return (
      <div className="card p-6">
        <p style={{ color: "var(--color-text-muted)" }}>Loading peer comparison...</p>
      </div>
    );
  }

  if (peerQuery.isError || !peerQuery.data?.peers.length) {
    return (
      <div className="card p-6">
        <p style={{ color: "var(--color-text-muted)" }}>
          Peer comparison is unavailable right now.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Sector Comparison {sector ? `— ${sector}` : ""}
        </h3>
        <span
          className="rounded px-2 py-0.5 text-[10px] font-medium"
          style={{ background: "var(--color-surface-offset)", color: "var(--color-text-muted)" }}
        >
          {peerQuery.data.peers.length} peers
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-divider)" }}>
              <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Stock</th>
              <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Price</th>
              <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Today</th>
              <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Exchange</th>
              <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>AI Signal</th>
            </tr>
          </thead>
          <tbody>
            {peerQuery.data.peers.map((peer) => {
              const isSelected = peer.symbol === ticker;
              const signal = getSignal(peer.changePercent);
              const signalColor = getSignalColor(signal);

              return (
                <tr
                  key={peer.symbol}
                  className="transition-colors hover:bg-white/[0.02]"
                  style={{
                    borderBottom: "1px solid var(--color-divider)",
                    background: isSelected ? "rgba(52,152,219,0.06)" : undefined,
                  }}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold" style={{ background: "var(--color-surface-offset)", color: "var(--color-text-muted)" }}>
                        {peer.symbol.substring(0, 2)}
                      </div>
                      <div>
                        <p className="ticker text-[11px]">{peer.symbol.replace(".NS", "")}</p>
                        <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>{peer.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs" data-financial style={{ color: "var(--color-text-primary)" }}>
                    {formatPrice(peer.price)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={cn("flex items-center justify-end gap-1 font-mono text-xs font-medium", getPriceColor(peer.changePercent))} data-financial>
                      {peer.changePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {formatPercent(peer.changePercent)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {peer.exchange}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className="inline-block rounded px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        background: `${signalColor}15`,
                        color: signalColor,
                        border: `1px solid ${signalColor}30`,
                      }}
                    >
                      {signal}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
