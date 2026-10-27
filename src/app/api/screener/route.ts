import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/server/rate-limit";
import { fetchMLJson, mlServiceErrorResponse } from "@/lib/server/ml";

export async function GET(request: Request) {
  try {
    const limit = await rateLimit("screener", request, 20, 60);
    if (!limit.ok) {
      return tooManyRequests(60);
    }

    // The ML service caches this for 30 minutes, so most requests resolve in
    // well under a second -- but the first request after that window expires
    // pays for 42 live yfinance fetches (measured ~57s), so this needs a much
    // longer allowance than the other ML-backed routes.
    const payload = await fetchMLJson("/screener", { timeoutMs: 90_000 });
    return NextResponse.json(payload);
  } catch (error) {
    const unavailable = mlServiceErrorResponse(error);
    if (unavailable) return unavailable;
    console.error("Screener API error:", error);
    return NextResponse.json(
      { error: "Failed to load screener data" },
      { status: 500 }
    );
  }
}
