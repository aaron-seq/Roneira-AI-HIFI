import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSymbolConfig } from "@/lib/market/constants";
import { getNormalizedQuotes } from "@/lib/server/market";
import { rateLimit, tooManyRequests } from "@/lib/server/rate-limit";
import { buildPortfolioCapture, PORTFOLIO_HISTORY_METHODOLOGY } from "@/lib/portfolio/history";
import {
  captureToRow, historyStartDate, holdingsFingerprint, HOLDING_COLUMNS,
  MAX_CAPTURE_HOLDINGS, SNAPSHOT_COLUMNS, snapshotFromRow,
  type CaptureHolding, type PortfolioSnapshotRow,
} from "@/lib/server/portfolio-history";

const currencySchema = z.enum(["INR", "USD"]);
const historySchema = z.object({
  currency: currencySchema.default("INR"),
  days: z.coerce.number().int().min(1).max(365).default(90),
}).strict();
const captureSchema = z.object({ currency: currencySchema }).strict();
const privateHeaders = { "Cache-Control": "private, no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: privateHeaders });
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const parameters = new URL(request.url).searchParams;
    // Reject duplicate fields rather than silently accepting their last value.
    if (Array.from(parameters.keys()).some((key) => parameters.getAll(key).length !== 1)) {
      return json({ error: "Provide a currency and a history range from 1 to 365 days." }, 400);
    }
    const parsed = historySchema.safeParse(Object.fromEntries(parameters));
    if (!parsed.success) return json({ error: "Provide a currency and a history range from 1 to 365 days." }, 400);
    const { currency, days } = parsed.data;
    const now = new Date();
    const { data, error: queryError } = await supabase.from("portfolio_valuation_snapshots")
      .select(SNAPSHOT_COLUMNS)
      .eq("user_id", user.id)
      .eq("currency", currency)
      .gte("valuation_date", historyStartDate(now, days))
      .lte("valuation_date", now.toISOString().slice(0, 10))
      .order("valuation_date", { ascending: true })
      .limit(days);
    if (queryError) return json({ error: "Portfolio history is unavailable. Check that database migrations are applied." }, 503);
    return json({
      currency, days,
      snapshots: ((data ?? []) as PortfolioSnapshotRow[]).map(snapshotFromRow),
      methodology: PORTFOLIO_HISTORY_METHODOLOGY,
    });
  } catch {
    return json({ error: "Failed to load portfolio history." }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const body = await request.json().catch(() => null);
    const parsed = captureSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Provide only the portfolio currency (INR or USD). Values are calculated by the server." }, 400);
    const limit = await rateLimit(`portfolio-capture:${user.id}`, request, 10, 60);
    if (!limit.ok) return tooManyRequests(60);

    const readHoldings = () => supabase.from("portfolio_holdings")
      .select(HOLDING_COLUMNS)
      .eq("user_id", user.id)
      .order("id", { ascending: true })
      .limit(MAX_CAPTURE_HOLDINGS + 1);
    const holdingsObservedAt = new Date();
    const { data, error: holdingsError } = await readHoldings();
    if (holdingsError) return json({ error: "Could not read your holdings. No capture was saved." }, 503);
    const holdings = (data ?? []) as CaptureHolding[];
    if (holdings.length > MAX_CAPTURE_HOLDINGS) return json({ error: `Captures currently support up to ${MAX_CAPTURE_HOLDINGS} holdings.` }, 422);

    const symbols = [...new Set(holdings.map((holding) => holding.ticker))];
    const quotes = symbols.length > 0
      ? await getNormalizedQuotes([...symbols, "USDINR=X"].map((symbol) => createSymbolConfig(symbol)))
      : [];
    const { data: latest, error: latestError } = await readHoldings();
    if (latestError) return json({ error: "Could not verify your holdings. No capture was saved." }, 503);
    if (holdingsFingerprint(holdings) !== holdingsFingerprint((latest ?? []) as CaptureHolding[])) {
      return json({ error: "Your holdings changed while fetching prices. Refresh and capture again." }, 409);
    }
    const capture = buildPortfolioCapture(holdings, quotes, parsed.data.currency, new Date(), holdingsObservedAt);
    // The service role can write only after a real session has selected its own
    // book. Clients cannot supply totals, a target user, a day or quote evidence.
    const admin = createAdminClient();
    const { data: saved, error: saveError } = await admin.rpc("save_portfolio_valuation_snapshot", {
      p_snapshot: captureToRow(capture, user.id),
    }).single();
    if (saveError || !saved) return json({ error: "Could not save this portfolio capture." }, 503);
    return json({ snapshot: snapshotFromRow(saved as PortfolioSnapshotRow), methodology: PORTFOLIO_HISTORY_METHODOLOGY });
  } catch {
    return json({ error: "Failed to capture portfolio value. No successful save was confirmed." }, 500);
  }
}
