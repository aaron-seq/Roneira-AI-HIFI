import { NextResponse } from "next/server";
import { searchStocks } from "@/lib/server/market";
import { rateLimit, tooManyRequests } from "@/lib/server/rate-limit";
import { searchQuerySchema } from "@/lib/server/validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Bounded before it reaches searchStocks, which uses the query as a cache
  // key -- unbounded queries would mean an unbounded cache.
  const parsed = searchQuerySchema.safeParse(searchParams.get("q") || "");

  if (!parsed.success) {
    return NextResponse.json({ results: [] });
  }

  const query = parsed.data;

  // Backed by Alpha Vantage's 25-requests/day free tier when Finnhub misses;
  // this is typed-ahead from the UI, so it needs a ceiling.
  const limit = await rateLimit("search", request, 30, 60);
  if (!limit.ok) {
    return tooManyRequests(60);
  }

  try {
    const results = await searchStocks(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Stock search route error:", error);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
