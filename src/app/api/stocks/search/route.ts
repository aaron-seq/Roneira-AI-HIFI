import { NextResponse } from "next/server";
import { searchStocks } from "@/lib/server/market";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchStocks(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Stock search route error:", error);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
