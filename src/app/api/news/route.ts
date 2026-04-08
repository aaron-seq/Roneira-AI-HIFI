import { NextResponse } from "next/server";
import { getCachedValue } from "@/lib/server/cache";
import type { NewsArticle } from "@/lib/market/types";

const NEWS_API_KEY = process.env.NEWS_API_KEY || "";
const NEWS_TTL_MS = 5 * 60_000;

const POSITIVE_KEYWORDS = [
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

const NEGATIVE_KEYWORDS = [
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

function classifySentiment(text: string): NewsArticle["sentiment"] {
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

function extractTickers(text: string) {
  const matches = text.match(/\b[A-Z]{2,8}(?:\.NS|\.BO)?\b/g) || [];
  return Array.from(new Set(matches)).slice(0, 5);
}

function buildQuery(market: string, query: string) {
  if (query.trim()) {
    return query;
  }

  if (market === "india") {
    return "India stock market OR NSE OR BSE OR Sensex OR Nifty";
  }

  return "stock market OR equities OR investing";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get("market") || "global";
  const query = searchParams.get("q") || "";
  const page = searchParams.get("page") || "1";

  if (!NEWS_API_KEY) {
    return NextResponse.json({ articles: [], totalResults: 0 });
  }

  try {
    const payload = await getCachedValue(
      `news:${market}:${query}:${page}`,
      NEWS_TTL_MS,
      async () => {
        const q = buildQuery(market, query);
        const url =
          `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}` +
          `&language=en&sortBy=publishedAt&pageSize=12&page=${encodeURIComponent(
            page
          )}&apiKey=${NEWS_API_KEY}`;
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`News API failed: ${response.status}`);
        }

        return (await response.json()) as {
          articles?: Array<Record<string, unknown>>;
          totalResults?: number;
        };
      }
    );

    const articles: NewsArticle[] = (payload.articles || []).map(
      (article, index) => {
        const title = String(article.title || "Untitled");
        const description = String(article.description || "");
        const source =
          typeof article.source === "object" && article.source
            ? String((article.source as Record<string, unknown>).name || "Unknown")
            : "Unknown";
        const combinedText = `${title} ${description}`;

        return {
          id: String(article.url || `${market}-${page}-${index}`),
          title,
          description,
          source,
          url: String(article.url || "#"),
          publishedAt: String(article.publishedAt || new Date().toISOString()),
          category: market === "india" ? "india" : "global",
          sentiment: classifySentiment(combinedText),
          relatedTickers: extractTickers(combinedText),
          imageUrl: article.urlToImage ? String(article.urlToImage) : null,
        };
      }
    );

    return NextResponse.json({
      articles,
      totalResults: payload.totalResults || 0,
    });
  } catch (error) {
    console.error("News API error:", error);
    return NextResponse.json({ articles: [], totalResults: 0 }, { status: 500 });
  }
}
