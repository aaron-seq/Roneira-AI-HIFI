import { NextResponse } from "next/server";
import { searchStocks } from "@/lib/server/market";
import { rateLimit, tooManyRequests } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

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
