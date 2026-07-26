import { KNOWN_EQUITIES } from "@/lib/market/constants";
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

/**
 * Curated match phrase per KNOWN_EQUITIES symbol, deliberately hand-picked
 * rather than derived from `name.split(" ")[0]`. A mechanical first-word
 * split produces dangerously generic patterns for several of these --
 * "State Bank of India" -> "State", "Tech Mahindra" -> "Tech", "Tata
 * Consultancy Services" -> "Tata" (ambiguous across the whole Tata Group).
 * Alphabet also needs "Google" as an alias: that's overwhelmingly how it's
 * referred to in headlines, not "Alphabet".
 */
const STOCK_MATCH_PHRASES: Record<string, string> = {
  "RELIANCE.NS": "Reliance",
  "TCS.NS": "TCS",
  "INFY.NS": "Infosys",
  "HDFCBANK.NS": "HDFC Bank",
  "SBIN.NS": "State Bank",
  "WIPRO.NS": "Wipro",
  "TECHM.NS": "Tech Mahindra",
  "BAJFINANCE.NS": "Bajaj Finance",
  AAPL: "Apple",
  NVDA: "NVIDIA",
  MSFT: "Microsoft",
  GOOGL: "Google|Alphabet",
  AMZN: "Amazon",
};

/**
 * Whole-word match against a curated phrase per KNOWN_EQUITIES symbol --
 * deliberately stricter than extractTickers. That function matches any
 * 2-8 letter uppercase token (real example: "FCC", a regulator, not a
 * ticker), which is fine as a loose display hint but too unreliable to
 * anchor a "this article affects this stock, here's its chart" feature on.
 * Returns the first confident match's symbol, or null.
 */
export function matchKnownStock(text: string): string | null {
  for (const equity of KNOWN_EQUITIES) {
    const phrase = STOCK_MATCH_PHRASES[equity.symbol];
    if (!phrase) continue;
    const pattern = new RegExp(`\\b(${phrase})\\b`, "i");
    if (pattern.test(text)) {
      return equity.symbol;
    }
  }
  return null;
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
