"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Brain,
  ChevronDown,
} from "lucide-react";
import { PredictionChart } from "@/components/charts/PredictionChart";
import { CompetitorTable } from "@/components/prediction/CompetitorTable";
import { ModelScore } from "@/components/prediction/ModelScore";
import { StockSearch, type StockOption } from "@/components/prediction/StockSearch";
import { ModelSpread } from "@/components/prediction/ModelSpread";
import { SignalMeter } from "@/components/prediction/SignalMeter";
import { PredictionSkeleton } from "@/components/ui/Skeletons";
import { usePredictionMutation } from "@/lib/hooks/use-prediction";
import { getTimeframeDays } from "@/lib/market/timeframe";
import { cn, formatPercent, formatPrice, getPriceColor } from "@/lib/utils";

const TIMEFRAMES = [
  { value: "tomorrow", label: "1 trading session" },
  { value: "1week", label: "7 trading sessions" },
  { value: "1month", label: "30 trading sessions" },
  { value: "3month", label: "90 trading sessions" },
  { value: "6month", label: "180 trading sessions" },
  { value: "1year", label: "365 trading sessions" },
  { value: "1year_plus", label: "400 trading sessions" },
];

const MODELS = [
  { value: "ENSEMBLE", label: "Auto (Ensemble)" },
  { value: "LSTM", label: "Sequence model (gradient-boosted)" },
  { value: "RANDOM_FOREST", label: "Random Forest" },
  { value: "GAN", label: "Scenario model (gradient-boosted)" },
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
  const reduceMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const presetTicker = searchParams.get("ticker");
  // Derived once at mount, not synced in an effect: PredictPage keys this
  // component by ?ticker=, so a new deep link (including one from the command
  // palette while already on this page) remounts it. The old effect also
  // re-applied the preset every time the field was cleared, so typing over a
  // deep-linked ticker snapped back.
  const [selectedStock, setSelectedStock] = useState<StockOption | null>(() =>
    presetTicker
      ? {
          symbol: presetTicker,
          name: presetTicker,
          exchange: presetTicker.endsWith(".NS") ? "NSE" : "NASDAQ",
        }
      : null
  );
  const [timeframe, setTimeframe] = useState("1month");
  const [model, setModel] = useState("ENSEMBLE");
  const predictionMutation = usePredictionMutation();
  const result = predictionMutation.data;

  const resultMatchesControls = result && selectedStock?.symbol === result.ticker && timeframe === result.timeframe && model === result.model_used;

  function handleAnalyze() {
    if (!selectedStock) {
      return;
    }

    predictionMutation.mutate({
      ticker: selectedStock.symbol,
      timeframe,
      model_type: model,
    });
  }

  // The UI is completely data-agnostic, relying entirely on the `predictMutation`
  // response shape (from the FastAPI ML layer -> Next.js API)
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1
          className="text-3xl leading-tight"
          style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            color: "var(--color-text-primary)",
          }}
        >
          AI Prediction
        </h1>
        <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--color-text-muted)" }}>
          Explore each model&apos;s estimate and compare their targets. Historical
          tests did not establish a trading edge; the corrected walk-forward harness
          has not been rerun. These estimates are research inputs, not advice.
        </p>
      </div>

      <div className="card mb-8 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StockSearch value={selectedStock} onChange={setSelectedStock} disabled={predictionMutation.isPending} />

          <div className="relative">
            <label htmlFor="prediction-horizon" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Model horizon</label>
            <div className="relative">
              <select
                id="prediction-horizon"
                aria-describedby="prediction-horizon-help"
                disabled={predictionMutation.isPending}
                value={timeframe}
                onChange={(event) => setTimeframe(event.target.value)}
                className="w-full appearance-none rounded-lg py-2.5 pl-4 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brass)]"
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
            <label htmlFor="prediction-model" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>Model</label>
            <div className="relative">
              <select
                id="prediction-model"
                disabled={predictionMutation.isPending}
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="w-full appearance-none rounded-lg py-2.5 pl-4 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brass)]"
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
                "flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-brass)] focus-visible:ring-offset-2",
                predictionMutation.isPending && "animate-pulse-glow"
              )}
              style={{
                color: selectedStock ? "#10121B" : undefined,
                background: !selectedStock
                  ? "var(--color-surface-offset)"
                  : "var(--gradient-hero)",
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
        <p id="prediction-horizon-help" className="mt-4 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Models count historical trading sessions, not calendar days. Holidays and
          closures make the actual date vary. Stored calendar target dates are not
          exchange-calendar forecasts.
        </p>
        {timeframe !== "1month" && ["ENSEMBLE", "LSTM", "GAN"].includes(model) && (
          <p role="status" className="mt-3 text-xs leading-relaxed" style={{ color: "var(--color-warning)" }}>
            Sequence and scenario models use artifacts trained for a fixed horizon.
            Selecting another horizon does not retrain them; this estimate may not match
            your requested session count. Compare the rule-based or Random Forest models instead.
          </p>
        )}
      </div>

      {predictionMutation.isPending ? (
        <div aria-busy="true">
          <p role="status" className="mb-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Analyzing {selectedStock?.symbol} for {getTimeframeDays(timeframe)} trading sessions…
          </p>
          <div aria-hidden="true"><PredictionSkeleton /></div>
        </div>
      ) : predictionMutation.isError ? (
        <div role="alert" className="card p-6">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Analysis unavailable</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            We could not complete this analysis. Try again, or choose another stock or model.
            No new estimate is available.
          </p>
          <button onClick={handleAnalyze} disabled={!selectedStock} className="btn-secondary mt-4">Try analysis again</button>
        </div>
      ) : (
        <AnimatePresence>
          {result && (
            <motion.div variants={resultsVariants} initial={reduceMotion ? false : "hidden"} animate="visible" exit="hidden" className="space-y-6" aria-label="Prediction results">
              <p role="status" className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Analysis complete for {result.ticker} · {getTimeframeDays(result.timeframe)} trading sessions.
              </p>
              {!resultMatchesControls && (
                <p role="status" className="rounded-xl border p-4 text-sm" style={{ color: "var(--color-warning)", borderColor: "var(--color-border)" }}>
                  These results are from your previous analysis. Run Analyze to update them for the selected stock, horizon or model.
                </p>
              )}
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
                          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "var(--color-brass-dim)", color: "var(--color-brass-bright)", border: "1px solid rgba(200,146,47,0.3)" }}>
                            {result.model_used}
                          </span>
                        </div>
                        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{result.company_name}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>Latest Historical Close</p>
                        <p className="break-words font-mono text-lg font-bold sm:text-xl" data-financial style={{ color: "var(--color-text-primary)" }}>
                          {formatPrice(result.current_price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>Model Estimate</p>
                        <p className={cn("break-words font-mono text-lg font-bold sm:text-xl", getPriceColor(result.price_change))} data-financial>
                          {formatPrice(result.predicted_price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>Estimated Change</p>
                        <p className={cn("font-mono text-lg font-semibold", getPriceColor(result.price_change_percent))} data-financial>
                          {formatPercent(result.price_change_percent)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-faint)" }}>Requested Horizon</p>
                        <p className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          {TIMEFRAMES.find((entry) => entry.value === result.timeframe)?.label}
                        </p>
                      </div>
                    </div>

                    <p className="mt-6 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                      Illustrative range: {formatPrice(result.price_target_low)} to {formatPrice(result.price_target_high)}.
                      These volatility-based reference levels are not calibrated probability bounds.
                    </p>

                    {/* No per-factor confidence tiles: the API's confidence_breakdown
                        is one confidence number scaled by fixed constants
                        (e.g. sentiment = 0.5x) -- nothing measures sentiment or
                        fundamentals -- so showing four "scores" invented three. */}
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <ModelScore score={result.confidence} />
                    <p className="mt-4 font-mono text-xs" data-financial style={{ color: "var(--color-text-faint)" }}>
                      Computed in {result.computation_time_ms.toFixed(0)}ms
                    </p>
                  </div>
                </div>
              </motion.div>

              {result.components && result.components.length > 0 && (
                <motion.div variants={cardVariant}>
                  <ModelSpread
                    components={result.components}
                    currentPrice={result.current_price}
                    blendedPrice={result.predicted_price}
                    agreementScore={result.agreement_score}
                    priceSpread={result.price_spread}
                  />
                </motion.div>
              )}

              <motion.div variants={cardVariant} className="card p-6">
                <h3 className="mb-6 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  Signal Analysis
                </h3>
                {/* One meter, for the horizon that was actually requested. This
                    showed "Short-Term (1D-1W)" and "Long-Term (1M-1Y)" side by
                    side, but the service computes a single horizon per call;
                    the second meter restated the first under a different label. */}
                <div className="flex flex-col items-center">
                  <p className="mb-3 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                    Signal · {TIMEFRAMES.find((entry) => entry.value === result.timeframe)?.label ?? result.timeframe}
                  </p>
                  <SignalMeter signal={result.short_term_signal.signal} score={result.short_term_signal.score} />
                </div>

                <div className="mt-6 overflow-x-auto" tabIndex={0} role="region" aria-label="Technical indicator values">
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
                  horizonSessions={getTimeframeDays(result.timeframe)}
                />
              </motion.div>

              <motion.div variants={cardVariant}>
                <CompetitorTable ticker={result.ticker} sector={result.sector} />
              </motion.div>

              <motion.div variants={cardVariant} className="card p-6">
                <div className="mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" style={{ color: "var(--color-info)" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    Illustrative Price Levels
                  </h3>
                </div>
                <p className="mb-4 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                  Lower and upper references use historical volatility. They do not represent measured odds, loss limits or guaranteed outcomes.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl p-5 text-center" style={{ background: "rgba(231,76,60,0.06)", border: "1px solid rgba(231,76,60,0.15)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#E74C3C" }}>Lower Reference</p>
                    <p className="mt-2 font-mono text-2xl font-bold" data-financial style={{ color: "#E74C3C" }}>
                      {formatPrice(result.price_target_low)}
                    </p>
                    <p className="mt-1 font-mono text-xs" data-financial style={{ color: "var(--color-text-faint)" }}>
                      {formatPercent(((result.price_target_low - result.current_price) / result.current_price) * 100)}
                    </p>
                  </div>
                  <div className="rounded-xl p-5 text-center" style={{ background: "var(--color-brass-dim)", border: "1px solid rgba(200,146,47,0.25)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-brass-bright)" }}>Model Estimate</p>
                    <p className="mt-2 font-mono text-2xl font-bold" data-financial style={{ color: "var(--color-brass-bright)" }}>
                      {formatPrice(result.predicted_price)}
                    </p>
                    <p className={cn("mt-1 font-mono text-xs font-semibold", getPriceColor(result.price_change_percent))} data-financial>
                      {formatPercent(result.price_change_percent)}
                    </p>
                  </div>
                  <div className="rounded-xl p-5 text-center" style={{ background: "rgba(46,204,113,0.06)", border: "1px solid rgba(46,204,113,0.15)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#2ECC71" }}>Upper Reference</p>
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

      {!result && !predictionMutation.isPending && !predictionMutation.isError && (
        <div className="card flex flex-col items-center justify-center px-4 py-16 text-center sm:py-20">
          <Brain className="mb-4 h-16 w-16" style={{ color: "var(--color-brass)", opacity: 0.3 }} />
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

function PredictPageKeyed() {
  return <PredictPageContent key={useSearchParams().get("ticker") ?? ""} />;
}

export default function PredictPage() {
  return (
    <Suspense fallback={<PredictionSkeleton />}>
      <PredictPageKeyed />
    </Suspense>
  );
}
