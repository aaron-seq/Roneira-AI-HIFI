import { NextResponse } from "next/server";
import { getQuoteHistory } from "@/lib/server/market";

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
