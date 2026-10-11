import { NextResponse } from "next/server";
import { dueAlerts, marketOf, marketSessionDate, type ArmedAlert, type Market } from "@/lib/alerts/evaluate";
import { createSymbolConfig } from "@/lib/market/constants";
import { getNormalizedQuotes } from "@/lib/server/market";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Evaluate armed watchlist price alerts for one market, after its close.
 * Scheduled by vercel.json; see docs/adr/0001-alerts-on-vercel-cron.md.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Without the secret set,
 * every call is rejected -- an unauthenticated route that writes
 * notifications for every user must not be reachable by accident.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const market = new URL(request.url).searchParams.get("market") as Market | null;
  if (market !== "india" && market !== "us") {
    return NextResponse.json({ error: "market must be india or us" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("watchlist")
    .select("id, user_id, ticker, exchange, alert_price, alert_revision, alert_armed_at, users(preferences)")
    .not("alert_price", "is", null)
    .is("alert_triggered_at", null);
  if (error) {
    console.error("Alert cron: could not load armed alerts", error);
    return NextResponse.json({ error: "Could not load alerts" }, { status: 500 });
  }

  // Users who switched Price Alerts off in Settings keep their levels but
  // get no notifications; missing preferences default to on.
  type Row = ArmedAlert & { users: { preferences: { notifications?: { priceAlerts?: boolean } } | null } | null };
  const armed = ((data ?? []) as unknown as Row[]).filter(
    (row) =>
      marketOf(row.exchange) === market &&
      row.users?.preferences?.notifications?.priceAlerts !== false
  );
  const tickers = Array.from(new Set(armed.map((row) => row.ticker)));
  const quotes = tickers.length
    ? await getNormalizedQuotes(tickers.map((ticker) => createSymbolConfig(ticker)))
    : [];
  const evaluatedAt = new Date();
  const due = dueAlerts(armed, new Map(quotes.map((quote) => [quote.symbol, quote])), 20, evaluatedAt);

  let fired = 0;
  let failed = 0;
  for (const alert of due) {
    // The claim and notification are one database transaction. Insert errors
    // roll back the claim, keeping the alert retryable. Re-check the price and
    // revision so a user changing/re-arming a level while quotes load cannot
    // receive a notification for the stale snapshot.
    const { data: delivered, error: deliverError } = await supabase.rpc("deliver_price_alert", {
      p_watchlist_id: alert.id,
      p_expected_price: alert.alert_price,
      p_expected_revision: alert.alert_revision,
      p_session_date: marketSessionDate(market, evaluatedAt),
    });
    if (deliverError) {
      console.error(`Alert cron: delivery for ${alert.id} failed`, deliverError);
      failed += 1;
      continue;
    }
    if (delivered === true) fired += 1;
  }

  return NextResponse.json(
    { market, armed: armed.length, quoted: quotes.length, fired, failed },
    { status: failed ? 503 : 200 }
  );
}
