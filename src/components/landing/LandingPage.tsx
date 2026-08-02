"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LineChart,
  Sparkles,
  Newspaper,
  ShieldCheck,
  Gauge,
  Layers,
  ArrowRight,
} from "lucide-react";
import { LandingTicker } from "@/components/landing/LandingTicker";
import { LandingChart } from "@/components/landing/LandingChart";
import { PredictionPreview } from "@/components/landing/PredictionPreview";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
  }),
};

const FEATURES = [
  {
    icon: Sparkles,
    title: "Six-model ensemble",
    description:
      "LSTM, GAN, gradient-boosted, and Random Forest predictors blended into one call, with a stated agreement score instead of a single confident-looking number.",
  },
  {
    icon: Gauge,
    title: "PDM momentum engine",
    description:
      "A price/volume/derivative momentum strategy that runs alongside the ML models, giving you a second, independent read on short-term direction.",
  },
  {
    icon: LineChart,
    title: "Live global markets",
    description:
      "NSE, BSE, NYSE, NASDAQ, European indices, commodities, forex, and crypto — real-time quotes refreshed every 60 seconds.",
  },
  {
    icon: Newspaper,
    title: "News linked to charts",
    description:
      "Headlines are matched to the actual stock they mention, so a story about Reliance takes you straight to Reliance's chart, not a loose keyword guess.",
  },
  {
    icon: Layers,
    title: "Fundamentals screener",
    description:
      "Large, mid, and small-cap screens ranked on ROE, debt-to-equity, PEG, and growth — refreshed on a schedule, not scraped on demand.",
  },
  {
    icon: ShieldCheck,
    title: "Audited & accountable",
    description:
      "Every prediction and portfolio action is written to an audit log, so what the model told you and when is never lost after the fact.",
  },
];

export function LandingPage() {
  return (
    <div style={{ background: "var(--color-bg)" }}>
      {/* Nav */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between border-b px-6 py-4 backdrop-blur-md sm:px-10"
        style={{ borderColor: "var(--color-divider)", background: "rgba(10,12,19,0.75)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#000000" }}>
            <Image src="/roneira-mark.png" alt="Roneira" width={18} height={18} className="h-[18px] w-[18px]" priority />
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Roneira AI HIFI
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium transition-colors hover:text-white"
            style={{ color: "var(--color-text-muted)" }}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #3498DB 0%, #2C7BB5 100%)" }}
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-16 pt-16 sm:px-10 sm:pt-24">
        <div
          className="pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full opacity-[0.08]"
          style={{ background: "radial-gradient(circle, #C8922F 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -right-40 top-20 h-[480px] w-[480px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #3498DB 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-divider) 1px, transparent 1px), linear-gradient(90deg, var(--color-divider) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 75%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border px-4 py-1.5"
            style={{ borderColor: "rgba(200,146,47,0.3)", background: "var(--color-brass-dim)" }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--color-brass-bright)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--color-brass-bright)" }}>
              Six models. One honest answer.
            </span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0.1}
            className="mx-auto max-w-3xl text-center text-[2.75rem] leading-[1.05] sm:text-6xl"
            style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", color: "var(--color-text-primary)" }}
          >
            AI-driven market intelligence that shows its work
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0.2}
            className="mx-auto mt-6 max-w-xl text-center text-base leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            Live NSE, BSE, and global market data feeding an ensemble of
            prediction models that tell you when they agree — and when they
            don&apos;t.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0.3}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #3498DB 0%, #2C7BB5 100%)" }}
            >
              Create a free account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="rounded-lg border px-6 py-3 text-sm font-semibold transition-colors duration-200 hover:bg-white/5"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}
            >
              Sign in
            </Link>
          </motion.div>
        </div>
      </section>

      <LandingTicker />

      {/* Interactive chart + live prediction */}
      <section className="px-6 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.4fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <LandingChart />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <PredictionPreview />
          </motion.div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="px-6 py-16 sm:px-10 sm:py-24" style={{ background: "var(--color-surface)" }}>
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mb-14 max-w-xl text-center"
          >
            <h2
              className="text-3xl sm:text-4xl"
              style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", color: "var(--color-text-primary)" }}
            >
              Everything you need, none of the noise
            </h2>
            <p className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
              Built for people who want a second opinion, not a black box.
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: (index % 3) * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="card p-6"
              >
                <div
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: "var(--color-surface-offset)" }}
                >
                  <feature.icon className="h-5 w-5" style={{ color: "var(--color-info)" }} />
                </div>
                <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 sm:px-10 sm:py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="card mx-auto flex max-w-3xl flex-col items-center gap-6 p-10 text-center sm:p-14"
          style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-elevated)" }}
        >
          <h2
            className="text-3xl sm:text-4xl"
            style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", color: "var(--color-text-primary)" }}
          >
            See what the models see
          </h2>
          <p className="max-w-md text-sm" style={{ color: "var(--color-text-muted)" }}>
            Free to start. Live data, real predictions, no credit card.
          </p>
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-lg px-7 py-3.5 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #3498DB 0%, #2C7BB5 100%)" }}
          >
            Create a free account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      <footer
        className="border-t px-6 py-8 text-center text-xs sm:px-10"
        style={{ borderColor: "var(--color-divider)", color: "var(--color-text-faint)" }}
      >
        Copyright {new Date().getFullYear()} Roneira AI HIFI. All rights reserved.
      </footer>
    </div>
  );
}
