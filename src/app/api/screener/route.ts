import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/server/rate-limit";

const ML_BACKEND_URL = process.env.ML_BACKEND_URL || "http://localhost:8000";
const ML_SERVICE_TOKEN = process.env.ML_SERVICE_TOKEN || "";

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
    const response = await fetch(`${ML_BACKEND_URL}/screener`, {
      headers: { "X-ML-Service-Token": ML_SERVICE_TOKEN },
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok) {
      // Logged server-side only: the upstream body is FastAPI's, and can carry
      // stack traces / internal schema that a client of this route never needs.
      const errorText = await response.text();
      console.error("Screener backend error:", errorText);
      return NextResponse.json(
        { error: "Screener service unavailable" },
        { status: 502 }
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Screener API error:", error);
    return NextResponse.json(
      { error: "Failed to load screener data" },
      { status: 500 }
    );
  }
}
