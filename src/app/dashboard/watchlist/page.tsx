"use client";

import { useDeferredValue, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  Brain,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { TableSkeleton } from "@/components/ui/Skeletons";
import { usePredictionMutation, useStockSearch } from "@/lib/hooks/use-prediction";
import { useWatchlist } from "@/lib/hooks/use-watchlist";
import { cn, formatPercent, formatPrice, getPriceColor } from "@/lib/utils";

export default function WatchlistPage() {
  const router = useRouter();
  const watchlist = useWatchlist();
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [alertModal, setAlertModal] = useState<string | null>(null);
  const [alertInput, setAlertInput] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "change" | "price">("name");
  const deferredSearch = useDeferredValue(addSearch);
  const searchQuery = useStockSearch(deferredSearch);
  const predictionMutation = usePredictionMutation();

  const sortedRows = [...watchlist.rows].sort((left, right) => {
    if (sortBy === "change") return right.changePercent - left.changePercent;
    if (sortBy === "price") return right.price - left.price;
    return left.ticker.localeCompare(right.ticker);
  });

  async function handleAddStock(stock: {
    symbol: string;
    name: string;
    exchange: string;
  }) {
    await watchlist.addMutation.mutateAsync({
      symbol: stock.symbol,
      exchange: stock.exchange,
    });
    setShowAddModal(false);
    setAddSearch("");
  }

  async function handleSetAlert(id: string, price: number | null) {
    await watchlist.alertMutation.mutateAsync({
      id,
      alertPrice: price,
    });
    setAlertModal(null);
    setAlertInput("");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Watchlist
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {watchlist.rows.length} live-tracked symbols with alert support
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "var(--color-surface)" }}>
            <SlidersHorizontal className="ml-2 h-3.5 w-3.5" style={{ color: "var(--color-text-faint)" }} />
            {(["name", "change", "price"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setSortBy(value)}
                className="rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                style={{
                  background:
                    sortBy === value ? "var(--color-surface-offset)" : "transparent",
                  color:
                    sortBy === value
                      ? "var(--color-text-primary)"
                      : "var(--color-text-faint)",
                }}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #3498DB, #2980B9)" }}
          >
            <Plus className="h-4 w-4" />
            Add Stock
          </button>
        </div>
      </div>

      {watchlist.isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : watchlist.isError ? (
        <div className="card p-6">
          <p style={{ color: "var(--color-text-muted)" }}>
            Your watchlist could not be loaded. Make sure your Supabase schema is
            applied and that you are signed in.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-divider)", background: "var(--color-surface-2)" }}>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Change</th>
                  <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Alert</th>
                  <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {sortedRows.map((stock) => (
                    <motion.tr
                      key={stock.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="group transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: "1px solid var(--color-divider)" }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold" style={{ background: "var(--color-surface-offset)", color: "var(--color-text-muted)" }}>
                            {stock.ticker.substring(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="ticker text-xs">{stock.ticker.replace(".NS", "")}</p>
                              <span
                                className="rounded px-1.5 py-0.5 text-[8px] font-bold"
                                style={{
                                  background:
                                    stock.exchange === "NSE"
                                      ? "rgba(52,152,219,0.15)"
                                      : "rgba(155,89,182,0.15)",
                                  color:
                                    stock.exchange === "NSE" ? "#3498DB" : "#9B59B6",
                                }}
                              >
                                {stock.exchange}
                              </span>
                            </div>
                            <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                              {stock.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium" data-financial style={{ color: "var(--color-text-primary)" }}>
                        {formatPrice(stock.price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn("flex items-center justify-end gap-1 font-mono text-xs font-semibold", getPriceColor(stock.changePercent))} data-financial>
                          {stock.changePercent >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {formatPercent(stock.changePercent)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {stock.alert_price ? (
                          <span className="font-mono text-xs" data-financial style={{ color: "var(--color-warning)" }}>
                            {formatPrice(stock.alert_price)}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setAlertModal(stock.id);
                              setAlertInput(stock.alert_price?.toString() || "");
                            }}
                            className="rounded p-1.5 transition-colors hover:bg-white/5"
                            title="Set price alert"
                          >
                            {stock.alert_price ? (
                              <Bell className="h-3.5 w-3.5" style={{ color: "var(--color-warning)" }} />
                            ) : (
                              <BellOff className="h-3.5 w-3.5" style={{ color: "var(--color-text-faint)" }} />
                            )}
                          </button>
                          <button
                            onClick={async () => {
                              await predictionMutation.mutateAsync({
                                ticker: stock.ticker,
                                timeframe: "1month",
                                model_type: "ENSEMBLE",
                              });
                              router.push(`/dashboard/predict?ticker=${encodeURIComponent(stock.ticker)}`);
                            }}
                            className="rounded p-1.5 transition-colors hover:bg-white/5"
                            title="Quick predict"
                          >
                            <Brain className="h-3.5 w-3.5" style={{ color: "var(--color-ai-purple)" }} />
                          </button>
                          <button
                            onClick={() => watchlist.removeMutation.mutate(stock.id)}
                            className="rounded p-1.5 transition-colors hover:bg-white/5"
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--color-text-faint)" }} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {sortedRows.length === 0 && (
            <div className="p-8 text-center">
              <p style={{ color: "var(--color-text-muted)" }}>
                Your watchlist is empty. Add a stock to start tracking live moves.
              </p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass w-full max-w-md rounded-2xl p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Add to Watchlist
                </h3>
                <button onClick={() => setShowAddModal(false)} className="rounded-lg p-1.5 transition-colors hover:bg-white/5">
                  <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                </button>
              </div>
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-faint)" }} />
                <input
                  type="text"
                  value={addSearch}
                  onChange={(event) => setAddSearch(event.target.value)}
                  placeholder="Search for a stock..."
                  autoFocus
                  className="w-full rounded-lg py-3 pl-10 pr-4 text-sm outline-none"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {(searchQuery.data?.results ?? []).map((stock) => (
                  <button
                    key={stock.symbol}
                    onClick={() =>
                      handleAddStock({
                        symbol: stock.symbol,
                        name: stock.name,
                        exchange: stock.exchange,
                      })
                    }
                    className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition-colors hover:bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold" style={{ background: "var(--color-surface-offset)", color: "var(--color-text-muted)" }}>
                        {stock.symbol.substring(0, 2)}
                      </div>
                      <div>
                        <p className="ticker text-xs">{stock.symbol}</p>
                        <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                          {stock.name}
                        </p>
                      </div>
                    </div>
                    <Plus className="h-4 w-4" style={{ color: "var(--color-info)" }} />
                  </button>
                ))}

                {deferredSearch.length > 0 && searchQuery.data?.results.length === 0 && !searchQuery.isLoading && (
                  <p className="px-4 py-3 text-sm" style={{ color: "var(--color-text-faint)" }}>
                    No stocks found
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {alertModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setAlertModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass w-full max-w-sm rounded-2xl p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Set Price Alert
              </h3>
              <input
                type="number"
                value={alertInput}
                onChange={(event) => setAlertInput(event.target.value)}
                placeholder="Target price..."
                autoFocus
                className="mb-4 w-full rounded-lg px-4 py-3 text-sm outline-none"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleSetAlert(alertModal, alertInput ? Number(alertInput) : null)
                  }
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #F39C12, #E67E22)" }}
                >
                  Set Alert
                </button>
                <button
                  onClick={() => handleSetAlert(alertModal, null)}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Clear
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
