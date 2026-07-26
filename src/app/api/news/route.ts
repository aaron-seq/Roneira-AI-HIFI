import { NextResponse } from "next/server";
import { getCachedValue } from "@/lib/server/cache";
import { rateLimit, tooManyRequests } from "@/lib/server/rate-limit";
import type { NewsArticle } from "@/lib/market/types";
import {
  classifySentiment,
  extractTickers,
  buildQuery,
} from "@/lib/news/classify";

const NEWS_API_KEY = process.env.NEWS_API_KEY || "";
const NEWS_TTL_MS = 5 * 60_000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = searchParams.get("market") || "global";
  const query = searchParams.get("q") || "";
  const page = searchParams.get("page") || "1";

  if (!NEWS_API_KEY) {
    return NextResponse.json({ articles: [], totalResults: 0 });
  }

  // NewsAPI free tier is 100 requests/day; the 5-minute cache absorbs most
  // traffic, this caps what reaches the provider on a cache miss.
  const limit = await rateLimit("news", request, 30, 60);
  if (!limit.ok) {
    return tooManyRequests(60);
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
          signal: AbortSignal.timeout(10_000),
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
