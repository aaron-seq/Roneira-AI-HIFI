"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { PredictionResult } from "@/lib/market/types";
import { formatPercent, formatPrice, getSignalBadgeClass, getTickerCurrency } from "@/lib/utils";

const PREVIEW_TICKERS = [
  { ticker: "AAPL", label: "Apple" },
  { ticker: "NVDA", label: "NVIDIA" },
  { ticker: "RELIANCE.NS", label: "Reliance" },
  { ticker: "TCS.NS", label: "TCS" },
];

const TIMEFRAMES = [
  { value: "1month", label: "1 Month" },
  { value: "3month", label: "3 Months" },
  { value: "1year", label: "1 Year" },
];

function SignalIcon({ signal }: { signal: string }) {
  if (signal === "STRONG_BUY" || signal === "BUY") {
    return <TrendingUp className="h-4 w-4" />;
  }
  if (signal === "STRONG_SELL" || signal === "SELL") {
    return <TrendingDown className="h-4 w-4" />;
  }
  return <Minus className="h-4 w-4" />;
}

/**
 * Runs a real ensemble prediction through /api/predict -- the same public,
 * unauthenticated route the dashboard uses -- so a logged-out visitor gets a
 * genuine model output, not a mocked demo.
 */
export function PredictionPreview() {
  const [ticker, setTicker] = useState("AAPL");
  const [timeframe, setTimeframe] = useState("3month");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runPrediction() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, timeframe, model_type: "ENSEMBLE" }),
      });

      if (!response.ok) {
        throw new Error("Prediction service is unavailable right now");
      }

      const data = (await response.json()) as PredictionResult;
      setResult(data);
    } catch {
      setError("Couldn't reach the prediction model. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  }

  const currency = getTickerCurrency(ticker);

  return (
    <div className="card p-6 sm:p-8" style={{ boxShadow: "var(--shadow-elevated)" }}>
      <div className="mb-6 flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: "var(--color-brass-dim)" }}
        >
          <Sparkles className="h-4 w-4" style={{ color: "var(--color-brass-bright)" }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Try a live ensemble prediction
          </h3>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Real inference, no sign-in required
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {PREVIEW_TICKERS.map((item) => (
          <button
            key={item.ticker}
            onClick={() => setTicker(item.ticker)}
            className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200"
            style={{
              background: ticker === item.ticker ? "var(--color-info)" : "var(--color-surface-2)",
              color: ticker === item.ticker ? "#FFFFFF" : "var(--color-text-muted)",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {TIMEFRAMES.map((item) => (
          <button
            key={item.value}
            onClick={() => setTimeframe(item.value)}
            className="rounded-md px-2.5 py-1 text-xs transition-all duration-200"
            style={{
              background: "transparent",
              border: `1px solid ${timeframe === item.value ? "var(--color-brass)" : "var(--color-border)"}`,
              color: timeframe === item.value ? "var(--color-brass-bright)" : "var(--color-text-faint)",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <button
        onClick={runPrediction}
        disabled={loading}
        className="animate-pulse-glow w-full rounded-lg py-3 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #C8922F 0%, #8A7A46 100%)" }}
      >
        {loading ? "Running models…" : `Predict ${ticker}`}
      </button>

      <AnimatePresence mode="wait">
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-xs"
            style={{ color: "var(--color-loss)" }}
          >
            {error}
          </motion.p>
        )}

        {result && (
          <motion.div
            key={`${result.ticker}-${result.timeframe}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 space-y-4 border-t pt-5"
            style={{ borderColor: "var(--color-divider)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Predicted price ({TIMEFRAMES.find((t) => t.value === timeframe)?.label})
              </span>
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${getSignalBadgeClass(
                  result.short_term_signal.signal as "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL"
                )}`}
              >
                <SignalIcon signal={result.short_term_signal.signal} />
                {result.short_term_signal.signal.replace("_", " ")}
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="font-mono text-2xl font-semibold" data-financial style={{ color: "var(--color-brass-bright)" }}>
                {currency === "INR" ? "₹" : "$"}
                {formatPrice(result.predicted_price)}
              </span>
              <span
                className="font-mono text-sm font-semibold"
                data-financial
                style={{ color: result.price_change_percent >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}
              >
                {formatPercent(result.price_change_percent)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span style={{ color: "var(--color-text-faint)" }}>Model confidence</span>
              <span className="font-mono" data-financial style={{ color: "var(--color-text-primary)" }}>
                {result.confidence.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--color-surface-2)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--color-brass)" }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, result.confidence))}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
