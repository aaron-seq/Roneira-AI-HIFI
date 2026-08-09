"use client";

import { motion } from "framer-motion";
import { Newspaper } from "lucide-react";
import { useNewsFeed } from "@/lib/hooks/use-news-feed";

/**
 * Aggregates the same per-article sentiment classification the news page
 * uses (src/lib/news/classify.ts, computed server-side in /api/news) into
 * a single live "market mood" gauge -- a real read on today's headlines,
 * not a static illustration.
 */
export function SentimentPulse() {
  const newsQuery = useNewsFeed("global", "stock market");
  const articles = newsQuery.data?.articles ?? [];

  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const article of articles) {
    counts[article.sentiment] += 1;
  }
  const total = articles.length;
  const score = total > 0 ? ((counts.positive - counts.negative) / total) * 50 + 50 : 50;

  const mood =
    score >= 65 ? "Bullish" : score >= 55 ? "Leaning bullish" : score <= 35 ? "Bearish" : score <= 45 ? "Leaning bearish" : "Neutral";

  const moodColor =
    score >= 55 ? "var(--color-profit)" : score <= 45 ? "var(--color-loss)" : "var(--color-warning)";

  return (
    <div className="card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--color-surface-offset)" }}>
          <Newspaper className="h-4 w-4" style={{ color: "var(--color-info)" }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Live market sentiment
          </h3>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            From today&apos;s headlines
          </p>
        </div>
      </div>

      {newsQuery.isLoading && (
        <div className="h-24 animate-pulse rounded-lg" style={{ background: "var(--color-surface-offset)" }} />
      )}

      {!newsQuery.isLoading && total === 0 && (
        <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
          No live headlines available right now.
        </p>
      )}

      {total > 0 && (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-2xl font-semibold" style={{ color: moodColor }}>
              {mood}
            </span>
            <span className="font-mono text-xs" data-financial style={{ color: "var(--color-text-faint)" }}>
              {total} headlines
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--color-surface-2)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: moodColor }}
              initial={{ width: "50%" }}
              animate={{ width: `${Math.min(100, Math.max(0, score))}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          <div className="mt-4 flex justify-between text-xs" style={{ color: "var(--color-text-faint)" }}>
            <span className="text-profit">{counts.positive} positive</span>
            <span>{counts.neutral} neutral</span>
            <span className="text-loss">{counts.negative} negative</span>
          </div>
        </>
      )}
    </div>
  );
}
