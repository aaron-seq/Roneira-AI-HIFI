import { NextResponse } from "next/server";
import { getQuoteHistory } from "@/lib/server/market";
import { rateLimit, tooManyRequests } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const interval = searchParams.get("interval") || "1day";
  const range = searchParams.get("range") || "6month";

  if (!symbol) {
    return NextResponse.json(
      { error: "symbol is required" },
      { status: 400 }
    );
  }

  // Same tight upstream quota as /api/market-data; chart history is one
  // provider call per (symbol, interval, range) combination.
  const limit = await rateLimit("market-data-history", request, 60, 60);
  if (!limit.ok) {
    return tooManyRequests(60);
  }

  try {
    const candles = await getQuoteHistory(symbol, interval, range);
    return NextResponse.json({
      symbol,
      interval,
      range,
      candles,
    });
  } catch (error) {
    console.error("History route error:", error);
    return NextResponse.json(
      { error: "Failed to load chart history" },
      { status: 500 }
    );
  }
}
