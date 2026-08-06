"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";

/**
 * Real counts, not marketing filler: 49 unique symbols across
 * src/lib/market/constants.ts (16 indices + 20 commodities/forex/crypto +
 * 13 tracked equities), 6 models behind /api/predict's ENSEMBLE type
 * (LSTM, GAN, gradient-boost, Random Forest, PDM momentum, ensemble blend),
 * and 60s as the actual refetchInterval used by use-live-market.ts.
 */
const STATS = [
  { value: 49, suffix: "+", label: "Instruments tracked" },
  { value: 6, suffix: "", label: "Models per prediction" },
  { value: 60, suffix: "s", label: "Live data refresh" },
];

function Counter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: 1.2, bounce: 0 });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, motionValue, value]);

  useEffect(() => {
    return spring.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = `${Math.round(latest)}${suffix}`;
      }
    });
  }, [spring, suffix]);

  return (
    <span
      ref={ref}
      className="font-mono text-4xl font-semibold sm:text-5xl"
      data-financial
      style={{ color: "var(--color-text-primary)" }}
    >
      0{suffix}
    </span>
  );
}

export function StatCounters() {
  return (
    <div className="mx-auto grid max-w-2xl grid-cols-3 gap-6">
      {STATS.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <Counter value={stat.value} suffix={stat.suffix} />
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-faint)" }}>
            {stat.label}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
