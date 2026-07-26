import { NextResponse } from "next/server";
import {
  createSymbolConfig,
} from "@/lib/market/constants";
import {
  getCommoditiesForexPayload,
  getMarketOverviewPayload,
  getNormalizedQuotes,
  getPeerComparisonPayload,
} from "@/lib/server/market";
import { rateLimit, tooManyRequests } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const group = searchParams.get("group");
  const symbols = searchParams.get("symbols");
  const symbol = searchParams.get("symbol");

  // Backs onto Alpha Vantage / Twelve Data free tiers (tens of requests/day),
  // same rationale as /api/stocks/search and /api/news.
  const limit = await rateLimit("market-data", request, 60, 60);
  if (!limit.ok) {
    return tooManyRequests(60);
  }

  try {
    if (group === "market-overview") {
      return NextResponse.json(await getMarketOverviewPayload());
    }

    if (group === "commodities-forex") {
      return NextResponse.json(await getCommoditiesForexPayload());
    }

    if (group === "peer-comparison" && symbol) {
      return NextResponse.json(await getPeerComparisonPayload(symbol));
    }

    if (symbols) {
      const configs = symbols
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => createSymbolConfig(value));
      const data = await getNormalizedQuotes(configs);
      return NextResponse.json({
        data,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { error: "Provide either a group or symbols parameter." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Market data route error:", error);
    return NextResponse.json(
      { error: "Failed to load market data" },
      { status: 500 }
    );
  }
}
