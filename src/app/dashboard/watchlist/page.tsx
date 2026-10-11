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
import { Sparkline } from "@/components/shared/Sparkline";
import { TableSkeleton } from "@/components/ui/Skeletons";
import { Dialog } from "@/components/ui/Dialog";
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [predictingTicker, setPredictingTicker] = useState<string | null>(null);
  const [addingStock, setAddingStock] = useState<string | null>(null);
  const [settingAlert, setSettingAlert] = useState(false);
  const deferredSearch = useDeferredValue(addSearch);
  const searchQuery = useStockSearch(deferredSearch);
  const predictionMutation = usePredictionMutation();

  const sortedRows = [...watchlist.rows].sort((left, right) => {
    if (sortBy !== "name") {
      const leftValue = sortBy === "change" ? left.changePercent : left.price;
      const rightValue = sortBy === "change" ? right.changePercent : right.price;
      if (leftValue === null) return rightValue === null ? 0 : 1;
      if (rightValue === null) return -1;
      return rightValue - leftValue;
    }
    return left.ticker.localeCompare(right.ticker);
  });

  async function handleAddStock(stock: {
    symbol: string;
    name: string;
    exchange: string;
  }) {
    if (addingStock) return;
    setActionError(null);
    setAddingStock(stock.symbol);
    try {
      await watchlist.addMutation.mutateAsync({
        symbol: stock.symbol,
        exchange: stock.exchange,
      });
      setShowAddModal(false);
      setAddSearch("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not add that stock."
      );
    } finally {
      setAddingStock(null);
    }
  }

  async function handleSetAlert(id: string, price: number | null) {
    if (settingAlert) return;
    setActionError(null);
    if (price !== null && (!Number.isFinite(price) || price <= 0)) {
      setActionError("Enter an alert price above zero.");
      return;
    }
    setSettingAlert(true);
    try {
      await watchlist.alertMutation.mutateAsync({
        id,
        alertPrice: price,
      });
      setAlertModal(null);
      setAlertInput("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update the alert."
      );
    } finally {
      setSettingAlert(false);
    }
  }

  async function handleRemoveStock(id: string, ticker: string) {
    if (!window.confirm(`Remove ${ticker} from your watchlist?`)) return;
    setActionError(null);
    try {
      await watchlist.removeMutation.mutateAsync(id);
    } catch {
      setActionError("Could not remove this stock. Please try again.");
    }
  }

  async function handleQuickPredict(ticker: string) {
    setActionError(null);
    setPredictingTicker(ticker);
    try {
      await predictionMutation.mutateAsync({
        ticker,
        timeframe: "1month",
        model_type: "ENSEMBLE",
      });
      router.push(`/dashboard/predict?ticker=${encodeURIComponent(ticker)}`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : `Could not run a prediction for ${ticker}.`
      );
    } finally {
      setPredictingTicker(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Watchlist
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {watchlist.rows.length} live-tracked symbols with alert support
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Sort watchlist" className="flex items-center gap-1 rounded-lg p-1" style={{ background: "var(--color-surface)" }}>
            <SlidersHorizontal className="ml-2 h-3.5 w-3.5" style={{ color: "var(--color-text-faint)" }} />
            {(["name", "change", "price"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setSortBy(value)}
                aria-pressed={sortBy === value}
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
            onClick={() => { setActionError(null); setAddSearch(""); setShowAddModal(true); }}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #3498DB, #2980B9)" }}
          >
            <Plus className="h-4 w-4" />
            Add Stock
          </button>
        </div>
      </div>

      {watchlist.isLoading ? (
        <div role="status" aria-label="Loading watchlist" aria-busy="true"><TableSkeleton rows={6} columns={6} /></div>
      ) : watchlist.isError ? (
        <div className="card p-6" role="alert">
          <p style={{ color: "var(--color-text-muted)" }}>
            Your watchlist could not be loaded. Check your connection and try again.
          </p>
          <button onClick={() => watchlist.refetch()} disabled={watchlist.isFetching} className="mt-3 rounded-lg border px-3 py-2 text-sm">
            {watchlist.isFetching ? "Retrying..." : "Retry watchlist"}
          </button>
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
                  <th className="hidden px-4 py-3 text-right text-xs font-medium md:table-cell" style={{ color: "var(--color-text-faint)" }}>1M Trend</th>
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
                                  background: "var(--color-surface-offset)",
                                  color: "var(--color-text-muted)",
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
                        {stock.price === null ? <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Quote unavailable</span> : formatPrice(stock.price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {stock.changePercent === null ? <span aria-label="Change unavailable" style={{ color: "var(--color-text-muted)" }}>—</span> : <span className={cn("flex items-center justify-end gap-1 font-mono text-xs font-semibold", getPriceColor(stock.changePercent))} data-financial>
                          {stock.changePercent >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {formatPercent(stock.changePercent)}
                        </span>}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <Sparkline symbol={stock.ticker} className="ml-auto h-8 w-20" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {stock.alert_price ? (
                          <span className="flex flex-col items-end">
                            <span
                              className="font-mono text-xs"
                              data-financial
                              style={{ color: stock.alert_triggered_at ? "var(--color-text-faint)" : "var(--color-warning)" }}
                            >
                              {formatPrice(stock.alert_price)}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                              {stock.alert_triggered_at
                                ? `Hit ${new Date(stock.alert_triggered_at).toLocaleDateString()}`
                                : "Armed"}
                            </span>
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
                              setActionError(null);
                              setAlertInput(stock.alert_price?.toString() || "");
                            }}
                            className="rounded p-1.5 transition-colors hover:bg-white/5"
                            title={stock.alert_triggered_at ? "Alert hit -- set a level to re-arm" : "Set price alert"}
                            aria-label={`Set price alert for ${stock.ticker}`}
                          >
                            {stock.alert_price ? (
                              <Bell className="h-3.5 w-3.5" style={{ color: "var(--color-warning)" }} />
                            ) : (
                              <BellOff className="h-3.5 w-3.5" style={{ color: "var(--color-text-faint)" }} />
                            )}
                          </button>
                          <button
                            onClick={() => handleQuickPredict(stock.ticker)}
                            disabled={predictingTicker === stock.ticker}
                            className="rounded p-1.5 transition-colors hover:bg-white/5 disabled:opacity-50"
                            title="Quick predict"
                            aria-label={`Predict ${stock.ticker}`}
                          >
                            <Brain
                              className={cn(
                                "h-3.5 w-3.5",
                                predictingTicker === stock.ticker && "animate-pulse"
                              )}
                              style={{ color: "var(--color-brass)" }}
                            />
                          </button>
                          <button
                            onClick={() => handleRemoveStock(stock.id, stock.ticker)}
                            disabled={watchlist.removeMutation.isPending}
                            className="rounded p-1.5 transition-colors hover:bg-white/5"
                            title="Remove"
                            aria-label={`Remove ${stock.ticker}`}
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

      <Dialog open={showAddModal} onClose={() => setShowAddModal(false)} labelledBy="watchlist-add-title" className="max-w-md" dismissible={!addingStock}>
              <div className="mb-4 flex items-center justify-between">
                <h3 id="watchlist-add-title" className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Add to Watchlist
                </h3>
                <button disabled={Boolean(addingStock)} onClick={() => setShowAddModal(false)} aria-label="Close stock search" className="rounded-lg p-1.5 transition-colors hover:bg-white/5">
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
                  aria-label="Search stocks for your watchlist"
                  data-dialog-autofocus
                  disabled={Boolean(addingStock)}
                  className="w-full rounded-lg py-3 pl-10 pr-4 text-sm outline-none"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>
              {!addSearch.trim() && <p className="mb-3 text-sm" style={{ color: "var(--color-text-muted)" }}>Search by company name or symbol to add a stock.</p>}
              {addSearch.trim() && searchQuery.isLoading && <p role="status" className="mb-3 text-sm">Searching stocks...</p>}
              {addSearch.trim() && searchQuery.isError && <p role="alert" className="mb-3 text-sm">Stock search is unavailable. <button onClick={() => searchQuery.refetch()} className="underline">Retry search</button></p>}
              {actionError && <p role="alert" className="mb-3 text-sm" style={{ color: "var(--color-loss)" }}>{actionError}</p>}
              {addingStock && <p role="status" className="mb-3 text-sm">Adding {addingStock}...</p>}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {(searchQuery.data?.results ?? []).map((stock) => (
                  <button
                    key={stock.symbol}
                    disabled={Boolean(addingStock)}
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

                {deferredSearch.trim().length > 0 && searchQuery.data?.results.length === 0 && !searchQuery.isLoading && !searchQuery.isError && (
                  <p role="status" className="px-4 py-3 text-sm" style={{ color: "var(--color-text-faint)" }}>
                    No stocks match this search. Try another company name or symbol.
                  </p>
                )}
              </div>
      </Dialog>

      <Dialog open={Boolean(alertModal)} onClose={() => setAlertModal(null)} labelledBy="alert-dialog-title" describedBy="alert-dialog-description" className="max-w-sm" dismissible={!settingAlert}>
            <form onSubmit={(event) => { event.preventDefault(); if (alertModal) void handleSetAlert(alertModal, Number(alertInput)); }} aria-busy={settingAlert}>
              <div className="mb-2 flex items-center justify-between gap-3">
              <h3 id="alert-dialog-title" className="mb-1 text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Set Price Alert
              </h3>
              <button type="button" disabled={settingAlert} onClick={() => setAlertModal(null)} aria-label="Close price alert editor" className="rounded-lg p-1.5"><X className="h-4 w-4" /></button>
              </div>
              <p id="alert-dialog-description" className="mb-4 text-xs" style={{ color: "var(--color-text-faint)" }}>
                Checked after the market closes using eligible session prices.
                Fires once when the level is touched after it was set, then shows
                as hit until you set a new level.
              </p>
              <label htmlFor="watchlist-alert-price" className="mb-1 block text-xs">Alert price</label>
              <input
                id="watchlist-alert-price"
                type="number"
                required
                min="0"
                step="any"
                inputMode="decimal"
                value={alertInput}
                onChange={(event) => setAlertInput(event.target.value)}
                placeholder="Target price..."
                data-dialog-autofocus
                disabled={settingAlert}
                className="mb-4 w-full rounded-lg px-4 py-3 text-sm outline-none"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              />
              {actionError && <p role="alert" className="mb-3 text-sm" style={{ color: "var(--color-loss)" }}>{actionError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={settingAlert || !alertInput.trim()}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #F39C12, #E67E22)", color: "#10121B" }}
                >
                  {settingAlert ? "Saving..." : "Set Alert"}
                </button>
                <button
                  type="button"
                  disabled={settingAlert}
                  onClick={() => { if (alertModal) void handleSetAlert(alertModal, null); }}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Clear
                </button>
              </div>
            </form>
      </Dialog>

      <AnimatePresence>
        {actionError && !showAddModal && !alertModal && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border p-4 shadow-xl"
            role="alert"
            style={{
              background: "var(--color-surface-2)",
              borderColor: "#E74C3C",
            }}
          >
            <p className="flex-1 text-sm" style={{ color: "var(--color-text-primary)" }}>
              {actionError}
            </p>
            <button
              onClick={() => setActionError(null)}
              aria-label="Dismiss error"
              className="rounded-lg p-1 transition-colors hover:bg-white/5"
            >
              <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
