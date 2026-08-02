"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { PredictionComponent } from "@/lib/market/types";

/**
 * Where the constituent models landed, on a shared price axis.
 *
 * The blended number the ensemble returns is a single point estimate that hides
 * its own disagreement — four models clustered inside a dollar is a completely
 * different claim from one model calling BUY while another calls SELL, even when
 * the average is identical. Measured skill for the sequence slots is currently
 * zero against a no-change baseline, so presenting one confident figure would
 * overstate what the system knows. This puts the dispersion in front instead.
 *
 * Every value here is the model's own output (`components` from the ML service).
 * Nothing is interpolated or synthesised for visual effect.
 */

/**
 * Colour encodes direction relative to today, because that is what a mark's
 * position on the axis already means. Colouring by the model's signal instead
 * produced marks that contradicted themselves — Technical reports BUY while
 * targeting a price 6% below spot, which rendered as a green dot sitting on the
 * bearish side. The signal is printed as text instead, so a model whose call
 * disagrees with its own target is legible rather than disguised.
 */
function directionTone(delta: number) {
  if (delta > 0.25) return "var(--color-profit)";
  if (delta < -0.25) return "var(--color-loss)";
  return "var(--color-text-muted)";
}

const SIGNAL_LABEL: Record<string, string> = {
  STRONG_BUY: "strong buy",
  BUY: "buy",
  HOLD: "hold",
  SELL: "sell",
  STRONG_SELL: "strong sell",
};

/** Human-facing model names. Users don't need our internal enum. */
const LABELS: Record<string, string> = {
  RANDOM_FOREST: "Random forest",
  TECHNICAL: "Technical",
  PVD_MOMENTUM: "PVD momentum",
  LSTM: "Sequence model",
  GAN: "Scenario model",
  ENSEMBLE: "Ensemble",
};

interface ModelSpreadProps {
  components: PredictionComponent[];
  currentPrice: number;
  blendedPrice: number;
  agreementScore?: number | null;
  priceSpread?: number | null;
  currency?: string;
}

export function ModelSpread({
  components,
  currentPrice,
  blendedPrice,
  agreementScore,
  priceSpread,
  currency = "",
}: ModelSpreadProps) {
  const reduceMotion = useReducedMotion();

  if (components.length === 0) {
    return null;
  }

  // Axis spans every mark we draw, padded so end marks aren't flush to the edge.
  const values = [
    ...components.map((c) => c.predicted_price),
    currentPrice,
    blendedPrice,
  ];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || Math.max(1, currentPrice * 0.01)) * 0.18;
  const lo = min - pad;
  const hi = max + pad;
  const pct = (value: number) => ((value - lo) / (hi - lo)) * 100;

  const disagree = new Set(components.map((c) => c.signal)).size > 1;
  const sorted = [...components].sort(
    (a, b) => a.predicted_price - b.predicted_price
  );

  return (
    <section
      aria-label="Model agreement"
      className="rounded-xl border p-6"
      style={{
        background: "var(--color-bg)",
        borderColor: "var(--color-border)",
      }}
    >
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h2
            className="text-[1.35rem] leading-tight"
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              color: "var(--color-text-primary)",
            }}
          >
            {disagree ? "The models disagree" : "The models agree"}
          </h2>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {disagree
              ? "Each ran on the same history and reached a different call. Treat the blend as one view, not a consensus."
              : "Each ran on the same history and reached the same call."}
          </p>
        </div>

        <dl className="flex items-baseline gap-6">
          <div className="text-right">
            <dt
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ color: "var(--color-text-faint)" }}
            >
              Spread
            </dt>
            <dd
              className="font-mono text-sm"
              style={{ color: "var(--color-text-primary)" }}
            >
              {priceSpread == null ? "—" : `${currency}${priceSpread.toFixed(2)}`}
            </dd>
          </div>
          <div className="text-right">
            <dt
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ color: "var(--color-text-faint)" }}
            >
              Agreement
            </dt>
            <dd
              className="font-mono text-sm"
              style={{ color: "var(--color-brass-bright)" }}
            >
              {agreementScore == null
                ? "—"
                : `${Math.round(Math.max(0, Math.min(1, agreementScore)) * 100)}%`}
            </dd>
          </div>
        </dl>
      </header>

      {/* Axis. The "today" datum is the reference every mark is read against, so
          it gets the only full-height rule. */}
      <div className="relative mb-2 h-px" style={{ background: "var(--color-border)" }}>
        <div
          className="absolute -top-2 h-4 w-px"
          style={{
            left: `${pct(currentPrice)}%`,
            background: "var(--color-text-muted)",
          }}
        />
      </div>
      <div className="relative mb-7 h-4">
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap font-mono text-[10px]"
          style={{
            left: `${pct(currentPrice)}%`,
            color: "var(--color-text-muted)",
          }}
        >
          today {currency}
          {currentPrice.toFixed(2)}
        </span>
      </div>

      <ol className="space-y-3.5">
        {sorted.map((component, index) => {
          const left = pct(component.predicted_price);
          const todayLeft = pct(currentPrice);
          const delta =
            ((component.predicted_price - currentPrice) / currentPrice) * 100;
          const tone = directionTone(delta);
          // Keep the readout clear of the connector by placing it on the side
          // away from today, flipping near the right edge so it can't clip.
          const labelRight = left < todayLeft;

          return (
            <li key={component.name} className="grid grid-cols-[9.5rem_1fr] items-center gap-4">
              <div className="min-w-0">
                <p
                  className="truncate text-[13px]"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {LABELS[component.name] ?? component.name}
                </p>
                <p
                  className="font-mono text-[10px]"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  w {component.weight.toFixed(2)} · conf{" "}
                  {component.confidence.toFixed(0)}% ·{" "}
                  {SIGNAL_LABEL[component.signal] ?? component.signal.toLowerCase()}
                </p>
              </div>

              <div className="relative h-7">
                {/* Distance travelled from spot. Deliberately faint: the mark is
                    the datum, this only carries magnitude. */}
                <motion.div
                  className="absolute top-1/2 h-px"
                  style={{
                    background: tone,
                    opacity: 0.18,
                    left: `${Math.min(left, todayLeft)}%`,
                  }}
                  initial={reduceMotion ? undefined : { width: 0 }}
                  animate={{ width: `${Math.abs(left - todayLeft)}%` }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.45,
                    delay: reduceMotion ? 0 : index * 0.06,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                />
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{ left: `${left}%` }}
                  initial={reduceMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.3,
                    delay: reduceMotion ? 0 : 0.2 + index * 0.06,
                  }}
                >
                  <span
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      width: 7,
                      height: 7,
                      background: tone,
                      // Weight as ring thickness: a low-weight model visibly
                      // makes a smaller claim on the blend.
                      boxShadow: `0 0 0 ${1 + component.weight * 4}px ${tone}22`,
                    }}
                  />
                  <span
                    className="absolute -translate-y-1/2 whitespace-nowrap font-mono text-[11px]"
                    style={
                      labelRight
                        ? { left: 12 }
                        : { right: 12 }
                    }
                  >
                    <span style={{ color: "var(--color-text-primary)" }}>
                      {currency}
                      {component.predicted_price.toFixed(2)}
                    </span>{" "}
                    <span style={{ color: tone }}>
                      {delta >= 0 ? "+" : ""}
                      {delta.toFixed(1)}%
                    </span>
                  </span>
                </motion.div>
              </div>
            </li>
          );
        })}
      </ol>

      <footer
        className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-4 text-[11px]"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span style={{ color: "var(--color-text-faint)" }}>Blended</span>
        <span
          className="font-mono"
          style={{ color: "var(--color-brass-bright)" }}
        >
          {currency}
          {blendedPrice.toFixed(2)}
        </span>
        <span style={{ color: "var(--color-text-faint)" }}>
          — weighted average of the above, not a separate forecast.
        </span>
      </footer>
    </section>
  );
}
