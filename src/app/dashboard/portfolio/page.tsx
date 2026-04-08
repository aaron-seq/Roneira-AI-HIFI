"use client";

import { useDeferredValue, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  DollarSign,
  Edit2,
  Plus,
  Search,
  Shield,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { CardGridSkeleton, TableSkeleton } from "@/components/ui/Skeletons";
import { usePortfolio } from "@/lib/hooks/use-portfolio";
import { useStockSearch } from "@/lib/hooks/use-prediction";
import { cn, formatCompact, formatPercent, formatPrice, getPriceColor } from "@/lib/utils";

type FormState = {
  id?: string;
  ticker: string;
  company_name: string;
  exchange: string;
  quantity: string;
  avg_buy_price: string;
  buy_date: string;
  sector: string;
};

const sectorColors = [
  "#3498DB",
  "#2ECC71",
  "#9B59B6",
  "#F39C12",
  "#E74C3C",
  "#1ABC9C",
  "#F1C40F",
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
};

function emptyFormState(): FormState {
  return {
    ticker: "",
    company_name: "",
    exchange: "NASDAQ",
    quantity: "",
    avg_buy_price: "",
    buy_date: "",
    sector: "",
  };
}

export default function PortfolioPage() {
  const portfolio = usePortfolio();
  const [showModal, setShowModal] = useState(false);
  const [formState, setFormState] = useState<FormState>(emptyFormState());
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const searchQuery = useStockSearch(deferredSearch);

  const totalInvested = portfolio.rows.reduce(
    (sum, holding) => sum + holding.investedValue,
    0
  );
  const totalCurrent = portfolio.rows.reduce(
    (sum, holding) => sum + holding.currentValue,
    0
  );
  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const dayChange = portfolio.rows.reduce(
    (sum, holding) => sum + holding.currentValue * (holding.pnlPercent / 100) * 0.1,
    0
  );
  const dayChangePct = totalCurrent > 0 ? (dayChange / totalCurrent) * 100 : 0;

  const sectorMap = new Map<string, number>();
  portfolio.rows.forEach((holding) => {
    const sector = holding.sector || "Unclassified";
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + holding.currentValue);
  });
  const sectors = Array.from(sectorMap.entries()).sort((left, right) => right[1] - left[1]);
  const concentration = sectors.reduce((sum, [, value]) => {
    const weight = totalCurrent > 0 ? value / totalCurrent : 0;
    return sum + weight * weight;
  }, 0);
  const riskScore = Math.min(10, Math.max(1, Number((concentration * 12).toFixed(1))));

  function openAddModal() {
    setFormState(emptyFormState());
    setSearch("");
    setShowModal(true);
  }

  function openEditModal(row: (typeof portfolio.rows)[number]) {
    setFormState({
      id: row.id,
      ticker: row.ticker,
      company_name: row.company_name,
      exchange: row.exchange,
      quantity: String(row.quantity),
      avg_buy_price: String(row.avg_buy_price),
      buy_date: row.buy_date || "",
      sector: row.sector || "",
    });
    setSearch(row.ticker);
    setShowModal(true);
  }

  async function handleSubmit() {
    await portfolio.upsertMutation.mutateAsync({
      id: formState.id,
      ticker: formState.ticker,
      company_name: formState.company_name,
      exchange: formState.exchange,
      quantity: Number(formState.quantity),
      avg_buy_price: Number(formState.avg_buy_price),
      buy_date: formState.buy_date || null,
      sector: formState.sector || null,
      tags: [],
    });
    setShowModal(false);
    setFormState(emptyFormState());
    setSearch("");
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Portfolio
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {portfolio.rows.length} holdings across {sectorMap.size || 0} sectors
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #2ECC71, #27AE60)" }}
        >
          <Plus className="h-4 w-4" />
          Add Holding
        </button>
      </div>

      {portfolio.isLoading ? (
        <div className="space-y-6">
          <CardGridSkeleton count={4} />
          <TableSkeleton rows={6} columns={9} />
        </div>
      ) : portfolio.isError ? (
        <div className="card p-6">
          <p style={{ color: "var(--color-text-muted)" }}>
            Your portfolio could not be loaded. Confirm the Supabase schema is in place.
          </p>
        </div>
      ) : (
        <>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <motion.div variants={itemVariants} className="card p-5">
              <div className="mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4" style={{ color: "var(--color-info)" }} />
                <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Total Value
                </p>
              </div>
              <p className="font-mono text-2xl font-bold" data-financial style={{ color: "var(--color-text-primary)" }}>
                {formatCompact(totalCurrent)}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-faint)" }}>
                Invested: {formatCompact(totalInvested)}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="card p-5">
              <div className="mb-2 flex items-center gap-2">
                {totalPnL >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-profit" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-loss" />
                )}
                <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Total P&amp;L
                </p>
              </div>
              <p className={cn("font-mono text-2xl font-bold", getPriceColor(totalPnL))} data-financial>
                {totalPnL >= 0 ? "+" : ""}
                {formatCompact(totalPnL)}
              </p>
              <p className={cn("mt-1 font-mono text-xs font-medium", getPriceColor(totalPnLPct))} data-financial>
                {formatPercent(totalPnLPct)}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="card p-5">
              <div className="mb-2 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" style={{ color: "var(--color-warning)" }} />
                <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Today&apos;s Change
                </p>
              </div>
              <p className={cn("font-mono text-2xl font-bold", getPriceColor(dayChange))} data-financial>
                {dayChange >= 0 ? "+" : ""}
                {formatCompact(dayChange)}
              </p>
              <p className={cn("mt-1 font-mono text-xs font-medium", getPriceColor(dayChangePct))} data-financial>
                {formatPercent(dayChangePct)}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="card p-5">
              <div className="mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" style={{ color: "var(--color-teal)" }} />
                <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Risk Score
                </p>
              </div>
              <p className="font-mono text-2xl font-bold" data-financial style={{ color: "#F39C12" }}>
                {riskScore.toFixed(1)}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-faint)" }}>
                Lower is more diversified
              </p>
            </motion.div>
          </motion.div>

          <div className="card mb-6 p-5">
            <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Sector Allocation
            </h3>
            <div className="flex h-4 w-full overflow-hidden rounded-full" style={{ background: "var(--color-surface-offset)" }}>
              {sectors.map(([sector, value], index) => (
                <div
                  key={sector}
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${totalCurrent > 0 ? (value / totalCurrent) * 100 : 0}%`,
                    background: sectorColors[index % sectorColors.length],
                    opacity: 0.85,
                  }}
                  title={`${sector}: ${((value / totalCurrent) * 100).toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              {sectors.map(([sector, value], index) => (
                <div key={sector} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: sectorColors[index % sectorColors.length] }} />
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {sector} ({totalCurrent > 0 ? ((value / totalCurrent) * 100).toFixed(1) : "0.0"}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-divider)", background: "var(--color-surface-2)" }}>
                    <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Stock</th>
                    <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Avg Buy</th>
                    <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>LTP</th>
                    <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Invested</th>
                    <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Current</th>
                    <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>P&amp;L</th>
                    <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>P&amp;L %</th>
                    <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.rows.map((holding) => (
                    <tr key={holding.id} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: "1px solid var(--color-divider)" }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold" style={{ background: "var(--color-surface-offset)", color: "var(--color-text-muted)" }}>
                            {holding.ticker.substring(0, 2)}
                          </div>
                          <div>
                            <p className="ticker text-xs">{holding.ticker.replace(".NS", "")}</p>
                            <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>{holding.company_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs" data-financial style={{ color: "var(--color-text-primary)" }}>
                        {holding.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs" data-financial style={{ color: "var(--color-text-muted)" }}>
                        {formatPrice(holding.avg_buy_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-medium" data-financial style={{ color: "var(--color-text-primary)" }}>
                        {formatPrice(holding.currentPrice)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs" data-financial style={{ color: "var(--color-text-muted)" }}>
                        {formatCompact(holding.investedValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs" data-financial style={{ color: "var(--color-text-primary)" }}>
                        {formatCompact(holding.currentValue)}
                      </td>
                      <td className={cn("px-4 py-3 text-right font-mono text-xs font-semibold", getPriceColor(holding.pnl))} data-financial>
                        {holding.pnl >= 0 ? "+" : ""}
                        {formatCompact(holding.pnl)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn("inline-block rounded px-2 py-0.5 font-mono text-[10px] font-bold", holding.pnl >= 0 ? "bg-profit-subtle text-profit" : "bg-loss-subtle text-loss")} data-financial>
                          {formatPercent(holding.pnlPercent)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditModal(holding)} className="rounded p-1.5 transition-colors hover:bg-white/5">
                            <Edit2 className="h-3.5 w-3.5" style={{ color: "var(--color-text-faint)" }} />
                          </button>
                          <button onClick={() => portfolio.removeMutation.mutate(holding.id)} className="rounded p-1.5 transition-colors hover:bg-white/5">
                            <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--color-text-faint)" }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {portfolio.rows.length === 0 && (
              <div className="p-8 text-center">
                <p style={{ color: "var(--color-text-muted)" }}>
                  Add your first holding to unlock sector allocation and live P&amp;L tracking.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass w-full max-w-xl rounded-2xl p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {formState.id ? "Edit Holding" : "Add Holding"}
                </h3>
                <button onClick={() => setShowModal(false)} className="rounded-lg p-1.5 transition-colors hover:bg-white/5">
                  <X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                </button>
              </div>

              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-faint)" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search AAPL, RELIANCE..."
                  className="w-full rounded-lg py-3 pl-10 pr-4 text-sm outline-none"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>

              {searchQuery.data?.results.length ? (
                <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
                  {searchQuery.data.results.slice(0, 5).map((result) => (
                    <button
                      key={result.symbol}
                      onClick={() => {
                        setFormState((current) => ({
                          ...current,
                          ticker: result.symbol,
                          company_name: result.name,
                          exchange: result.exchange,
                        }));
                        setSearch(result.symbol);
                      }}
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
                    >
                      <div>
                        <p className="ticker text-xs">{result.symbol}</p>
                        <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                          {result.name}
                        </p>
                      </div>
                      <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                        {result.exchange}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  value={formState.ticker}
                  onChange={(event) => setFormState((current) => ({ ...current, ticker: event.target.value.toUpperCase() }))}
                  placeholder="Ticker"
                  className="rounded-lg px-4 py-3 text-sm outline-none"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                />
                <input
                  value={formState.company_name}
                  onChange={(event) => setFormState((current) => ({ ...current, company_name: event.target.value }))}
                  placeholder="Company name"
                  className="rounded-lg px-4 py-3 text-sm outline-none"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                />
                <input
                  value={formState.exchange}
                  onChange={(event) => setFormState((current) => ({ ...current, exchange: event.target.value }))}
                  placeholder="Exchange"
                  className="rounded-lg px-4 py-3 text-sm outline-none"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                />
                <input
                  value={formState.sector}
                  onChange={(event) => setFormState((current) => ({ ...current, sector: event.target.value }))}
                  placeholder="Sector"
                  className="rounded-lg px-4 py-3 text-sm outline-none"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                />
                <input
                  type="number"
                  min="0"
                  value={formState.quantity}
                  onChange={(event) => setFormState((current) => ({ ...current, quantity: event.target.value }))}
                  placeholder="Quantity"
                  className="rounded-lg px-4 py-3 text-sm outline-none"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                />
                <input
                  type="number"
                  min="0"
                  value={formState.avg_buy_price}
                  onChange={(event) => setFormState((current) => ({ ...current, avg_buy_price: event.target.value }))}
                  placeholder="Average buy price"
                  className="rounded-lg px-4 py-3 text-sm outline-none"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                />
                <input
                  type="date"
                  value={formState.buy_date}
                  onChange={(event) => setFormState((current) => ({ ...current, buy_date: event.target.value }))}
                  className="rounded-lg px-4 py-3 text-sm outline-none"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                />
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={
                    !formState.ticker ||
                    !formState.company_name ||
                    !formState.exchange ||
                    !formState.quantity ||
                    !formState.avg_buy_price
                  }
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #2ECC71, #27AE60)" }}
                >
                  {formState.id ? "Save Changes" : "Add Holding"}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
