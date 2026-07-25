import type { NewsArticle } from "@/lib/market/types";

/**
 * Keyword-based news classification helpers.
 *
 * Extracted from the /api/news route handler so they can be unit tested
 * directly: Next.js validates the exports of a `route.ts` file, so shared
 * logic belongs in a module rather than as extra exports from the route.
 */

export const POSITIVE_KEYWORDS = [
  "surge",
  "gain",
  "beat",
  "growth",
  "rally",
  "upgrade",
  "bullish",
  "profit",
  "record",
];

export const NEGATIVE_KEYWORDS = [
  "drop",
  "fall",
  "miss",
  "cut",
  "bearish",
  "downgrade",
  "risk",
  "loss",
  "slump",
];

/**
 * Classify headline/summary text by keyword presence. Text containing signals
 * in both directions (or neither) is reported as neutral rather than guessing.
 */
export function classifySentiment(text: string): NewsArticle["sentiment"] {
  const normalized = text.toLowerCase();
  const positive = POSITIVE_KEYWORDS.some((keyword) =>
    normalized.includes(keyword)
  );
  const negative = NEGATIVE_KEYWORDS.some((keyword) =>
    normalized.includes(keyword)
  );

  if (positive && !negative) {
    return "positive";
  }

  if (negative && !positive) {
    return "negative";
  }

  return "neutral";
}

/** Pull up to five distinct ticker-shaped tokens out of free text. */
export function extractTickers(text: string) {
  const matches = text.match(/\b[A-Z]{2,8}(?:\.NS|\.BO)?\b/g) || [];
  return Array.from(new Set(matches)).slice(0, 5);
}

/** Build the upstream news query, falling back to a market-appropriate default. */
export function buildQuery(market: string, query: string) {
  if (query.trim()) {
    return query;
  }

  if (market === "india") {
    return "India stock market OR NSE OR BSE OR Sensex OR Nifty";
  }

  return "stock market OR equities OR investing";
}
