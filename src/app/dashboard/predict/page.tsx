"use client";

import { Suspense, useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Brain,
  ChevronDown,
  Search,
} from "lucide-react";
import { PredictionChart } from "@/components/charts/PredictionChart";
import { CompetitorTable } from "@/components/prediction/CompetitorTable";
import { ConfidenceRing } from "@/components/prediction/ConfidenceRing";
import { SignalMeter } from "@/components/prediction/SignalMeter";
import { PredictionSkeleton } from "@/components/ui/Skeletons";
import { usePredictionMutation, useStockSearch } from "@/lib/hooks/use-prediction";
import { cn, formatPercent, formatPrice, getConfidenceColor, getPriceColor } from "@/lib/utils";

interface StockOption {
  symbol: string;
  name: string;
  exchange: string;
}

const TIMEFRAMES = [
  { value: "tomorrow", label: "Tomorrow" },
  { value: "1week", label: "Next Week" },
  { value: "1month", label: "Next Month" },
  { value: "3month", label: "3 Months" },
  { value: "6month", label: "6 Months" },
  { value: "1year", label: "1 Year" },
  { value: "1year_plus", label: "1 Year+" },
];

const MODELS = [
  { value: "ENSEMBLE", label: "Auto (Ensemble)" },
  { value: "LSTM", label: "LSTM Deep Learning" },
  { value: "RANDOM_FOREST", label: "Random Forest" },
  { value: "GAN", label: "GAN Model" },
  { value: "TECHNICAL", label: "Technical Analysis" },
  { value: "PVD_MOMENTUM", label: "PVD Momentum" },
];

const resultsVariants = {
  hidden: { opacity: 0, y: 20, height: 0 },
  visible: {
    opacity: 1,
    y: 0,
    height: "auto",
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.08,
    },
  },
};

const cardVariant = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

function PredictPageContent() {
  const searchParams = useSearchParams();
  const presetTicker = searchParams.get("ticker");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStock, setSelectedStock] = useState<StockOption | null>(null);
  const [timeframe, setTimeframe] = useState("1month");
  const [model, setModel] = useState("ENSEMBLE");
  const [showSearch, setShowSearch] = useState(false);
  const deferredSearch = useDeferredValue(searchQuery);
  const stockSearchQuery = useStockSearch(deferredSearch);
  const predictionMutation = usePredictionMutation();
  const result = predictionMutation.data;
  const isPositive = result ? result.price_change >= 0 : false;

  useEffect(() => {
    if (presetTicker && !selectedStock) {
      setSelectedStock({
        symbol: presetTicker,
        name: presetTicker,
        exchange: presetTicker.endsWith(".NS") ? "NSE" : "NASDAQ",
      });
    }
  }, [presetTicker, selectedStock]);

  async function handleAnalyze() {
    if (!selectedStock) {
      return;
    }

    await predictionMutation.mutateAsync({
      ticker: selectedStock.symbol,
      timeframe,
      model_type: model,
    });
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="gradient-text text-3xl font-bold leading-tight">
          Stock Price Prediction Tool
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Live search, artifact-backed model inference, and chart projection from
          the Next.js launch surface
        </p>
      </div>

      <div className="card mb-8 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="relative md:col-span-1">
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Stock
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-faint)" }} />
              <input
                type="text"
                value={selectedStock ? selectedStock.symbol : searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSelectedStock(null);
                  setShowSearch(true);
                }}
                onFocus={() => setShowSearch(true)}
                placeholder="Search AAPL, RELIANCE..."
                className="w-full rounded-lg py-2.5 pl-10 pr-4 text-sm outline-none transition-all"
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              />

              {showSearch && searchQuery.length > 0 && !selectedStock && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border shadow-xl" style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}>
                  {(stockSearchQuery.data?.results ?? []).map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => {
                        setSelectedStock({
                          symbol: stock.symbol,
                          name: stock.name,
                          exchange: stock.exchange,
                        });
                        setSearchQuery("");
                        setShowSearch(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold" style={{ background: "var(--color-surface-offset)", color: "var(--color-text-muted)" }}>
                        {stock.symbol.substring(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="ticker truncate text-xs">{stock.symbol}</p>
                        <p className="truncate text-[11px]" style={{ color: "var(--color-text-muted)" }}>{stock.name}</p>
                      </div>
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "var(--color-surface-offset)", color: "var(--color-text-faint)" }}>
                        {stock.exchange}
                      </span>
                    </button>
                  ))}
                  {stockSearchQuery.data?.results.length === 0 && !stockSearchQuery.isLoading && (
                    <p className="px-4 py-3 text-sm" style={{ color: "var(--color-text-faint)" }}>No stocks found</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Timeline</label>
            <div className="relative">
              <select
                value={timeframe}
                onChange={(event) => setTimeframe(event.target.value)}
                className="w-full appearance-none rounded-lg py-2.5 pl-4 pr-10 text-sm outline-none"
                style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
              >
                {TIMEFRAMES.map((timeframeOption) => (
                  <option key={timeframeOption.value} value={timeframeOption.value}>
                    {timeframeOption.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-faint)" }} />
            </div>
          </div>

          <div className="relative">
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Model</label>
            <div className="relative">
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="w-full appearance-none rounded-lg py-2.5 pl-4 pr-10 text-sm outline-none"
                style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
              >
                {MODELS.map((modelOption) => (
                  <option key={modelOption.value} value={modelOption.value}>
                    {modelOption.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-faint)" }} />
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAnalyze}
              disabled={!selectedStock || predictionMutation.isPending}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-all duration-200",
                predictionMutation.isPending && "animate-pulse-glow"
              )}
              style={{
                background: !selectedStock
                  ? "var(--color-surface-offset)"
                  : "linear-gradient(135deg, #3498DB 0%, #9B59B6 100%)",
                opacity: !selectedStock ? 0.5 : 1,
                cursor: !selectedStock ? "not-allowed" : "pointer",
              }}
            >
              {predictionMutation.isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  ANALYZE
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {predictionMutation.isPending ? (
        <PredictionSkeleton />
      ) : predictionMutation.isError ? (
        <div className="card p-6">
          <p style={{ color: "var(--color-text-muted)" }}>
            The prediction service could not complete this request. Please verify
            the ML backend is running and try again.
          </p>
        </div>
      ) : (
        <AnimatePresence>
          {result && (
            <motion.div variants={resultsVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-6">
              <motion.div variants={cardVariant} className="card p-6">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold" style={{ background: "var(--color-surface-offset)", color: "var(--color-text-primary)" }}>
                        {result.ticker.substring(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="ticker text-sm">{result.ticker}</h3>
                          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "var(--color-surface-offset)", color: "var(--color-text-faint)" }}>
                            {result.exchange}
                          </span>
                          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "rgba(155,89,182,0.15)", color: "#9B59B6", border: "1px solid rgba(155,89,182,0.3)" }}>
                            {result.model_used}
                          </span>
                        </div>
                        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{result.company_name}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>Current Price</p>
                        <p className="font-mono text-xl font-bold" data-financial style={{ color: "var(--color-text-primary)" }}>
                          {formatPrice(result.current_price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>Predicted Target</p>
                        <p className={cn("font-mono text-xl font-bold", getPriceColor(result.price_change))} data-financial>
                          {formatPrice(result.predicted_price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>Expected Change</p>
                        <p className={cn("font-mono text-lg font-semibold", getPriceColor(result.price_change_percent))} data-financial>
                          {formatPercent(result.price_change_percent)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>Time Horizon</p>
                        <p className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          {TIMEFRAMES.find((entry) => entry.value === result.timeframe)?.label}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex items-center justify-between text-xs" style={{ color: "var(--color-text-faint)" }}>
                        <span>Low: {formatPrice(result.price_target_low)}</span>
                        <span>High: {formatPrice(result.price_target_high)}</span>
                      </div>
                      <div className="relative mt-1 h-2 w-full rounded-full" style={{ background: "var(--color-surface-offset)" }}>
                        <div
                          className="absolute top-0 h-full rounded-full"
                          style={{
                            left: "10%",
                            right: "10%",
                            background: `linear-gradient(90deg, ${isPositive ? "#2ECC71" : "#E74C3C"}, ${isPositive ? "#27AE60" : "#C0392B"})`,
                            opacity: 0.6,
                          }}
                        />
                        <div
                          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
                          style={{
                            left: `${Math.min(90, Math.max(10, 50 + result.price_change_percent * 3))}%`,
                            background: isPositive ? "#2ECC71" : "#E74C3C",
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-4 gap-3">
                      {Object.entries(result.confidence_breakdown).map(([key, value]) => (
                        <div key={key} className="rounded-lg p-3" style={{ background: "var(--color-bg)" }}>
                          <p className="text-[10px] capitalize" style={{ color: "var(--color-text-faint)" }}>{key}</p>
                          <p className="font-mono text-sm font-bold" data-financial style={{ color: getConfidenceColor(value) }}>
                            {value.toFixed(0)}%
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <ConfidenceRing score={result.confidence} />
                    <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Overall Confidence
                    </p>
                    <p className="mt-4 font-mono text-xs" data-financial style={{ color: "var(--color-text-faint)" }}>
                      Computed in {result.computation_time_ms.toFixed(0)}ms
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div variants={cardVariant} className="card p-6">
                <h3 className="mb-6 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Signal Analysis
                </h3>
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  <div className="flex flex-col items-center">
                    <p className="mb-3 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                      Short-Term Signal (1D–1W)
                    </p>
                    <SignalMeter signal={result.short_term_signal.signal} score={result.short_term_signal.score} />
                  </div>
                  <div className="flex flex-col items-center">
                    <p className="mb-3 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                      Long-Term Signal (1M–1Y)
                    </p>
                    <SignalMeter signal={result.long_term_signal.signal} score={result.long_term_signal.score} />
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--color-divider)" }}>
                        <th className="px-4 py-2 text-left text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Indicator</th>
                        <th className="px-4 py-2 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Value</th>
                        <th className="px-4 py-2 text-right text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>Signal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.indicators.map((indicator) => (
                        <tr key={indicator.name} style={{ borderBottom: "1px solid var(--color-divider)" }}>
                          <td className="px-4 py-2.5" style={{ color: "var(--color-text-primary)" }}>{indicator.name}</td>
                          <td className="px-4 py-2.5 text-right font-mono" data-financial style={{ color: "var(--color-text-muted)" }}>
                            {indicator.value.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="flex items-center justify-end gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                  background:
                                    indicator.signal === "Buy"
                                      ? "#2ECC71"
                                      : indicator.signal === "Sell"
                                        ? "#E74C3C"
                                        : "#F39C12",
                                }}
                              />
                              <span
                                style={{
                                  color:
                                    indicator.signal === "Buy"
                                      ? "#2ECC71"
                                      : indicator.signal === "Sell"
                                        ? "#E74C3C"
                                        : "#F39C12",
                                }}
                              >
                                {indicator.signal}
                              </span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              <motion.div variants={cardVariant}>
                <PredictionChart
                  symbol={result.ticker}
                  predictedPrice={result.predicted_price}
                  priceTargetLow={result.price_target_low}
                  priceTargetHigh={result.price_target_high}
                />
              </motion.div>

              <motion.div variants={cardVariant}>
                <CompetitorTable ticker={result.ticker} sector={result.sector} />
              </motion.div>

              <motion.div variants={cardVariant} className="card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" style={{ color: "var(--color-info)" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    Market Value Target
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl p-5 text-center" style={{ background: "rgba(231,76,60,0.06)", border: "1px solid rgba(231,76,60,0.15)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#E74C3C" }}>Bear Case</p>
                    <p className="mt-2 font-mono text-2xl font-bold" data-financial style={{ color: "#E74C3C" }}>
                      {formatPrice(result.price_target_low)}
                    </p>
                    <p className="mt-1 font-mono text-xs" data-financial style={{ color: "var(--color-text-faint)" }}>
                      {formatPercent(((result.price_target_low - result.current_price) / result.current_price) * 100)}
                    </p>
                  </div>
                  <div className="rounded-xl p-5 text-center" style={{ background: "rgba(52,152,219,0.06)", border: "1px solid rgba(52,152,219,0.15)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#3498DB" }}>Base Case</p>
                    <p className="mt-2 font-mono text-2xl font-bold" data-financial style={{ color: "#3498DB" }}>
                      {formatPrice(result.predicted_price)}
                    </p>
                    <p className={cn("mt-1 font-mono text-xs font-semibold", getPriceColor(result.price_change_percent))} data-financial>
                      {formatPercent(result.price_change_percent)}
                    </p>
                  </div>
                  <div className="rounded-xl p-5 text-center" style={{ background: "rgba(46,204,113,0.06)", border: "1px solid rgba(46,204,113,0.15)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#2ECC71" }}>Bull Case</p>
                    <p className="mt-2 font-mono text-2xl font-bold" data-financial style={{ color: "#2ECC71" }}>
                      {formatPrice(result.price_target_high)}
                    </p>
                    <p className="mt-1 font-mono text-xs" data-financial style={{ color: "var(--color-text-faint)" }}>
                      {formatPercent(((result.price_target_high - result.current_price) / result.current_price) * 100)}
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {!result && !predictionMutation.isPending && (
        <div className="card flex flex-col items-center justify-center py-20">
          <Brain className="mb-4 h-16 w-16" style={{ color: "var(--color-ai-purple)", opacity: 0.3 }} />
          <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-muted)" }}>
            Select a stock and click Analyze
          </h3>
          <p className="mt-1 max-w-md text-center text-sm" style={{ color: "var(--color-text-faint)" }}>
            Search US or Indian equities, choose a time horizon, and run the
            model you want to inspect.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {["AAPL", "RELIANCE.NS", "TSLA", "INFY.NS", "GOOGL"].map((ticker) => (
              <button
                key={ticker}
                onClick={() =>
                  setSelectedStock({
                    symbol: ticker,
                    name: ticker,
                    exchange: ticker.endsWith(".NS") ? "NSE" : "NASDAQ",
                  })
                }
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
              >
                <ArrowRight className="h-3 w-3" />
                {ticker}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PredictPage() {
  return (
    <Suspense fallback={<PredictionSkeleton />}>
      <PredictPageContent />
    </Suspense>
  );
}
