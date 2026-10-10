import { NextResponse } from "next/server";
import { dueAlerts, marketOf, type ArmedAlert, type Market } from "@/lib/alerts/evaluate";
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
    .select("id, user_id, ticker, exchange, alert_price, users(preferences)")
    .not("alert_price", "is", null)
    .is("alert_triggered_at", null);
  if (error) {
    console.error("Alert cron: could not load armed alerts", error);
    return NextResponse.json({ error: "Could not load alerts" }, { status: 500 });
  }

  // Users who switched Price Alerts off in Settings keep their levels but
  // get no notifications; missing preferences default to on.
  type Row = ArmedAlert & { users: { preferences: { notifications?: { priceAlerts?: boolean } } | null } | null };
  const armed = (data as unknown as Row[]).filter(
    (row) =>
      marketOf(row.exchange) === market &&
      row.users?.preferences?.notifications?.priceAlerts !== false
  );
  const tickers = Array.from(new Set(armed.map((row) => row.ticker)));
  const quotes = tickers.length
    ? await getNormalizedQuotes(tickers.map((ticker) => createSymbolConfig(ticker)))
    : [];
  const due = dueAlerts(armed, new Map(quotes.map((quote) => [quote.symbol, quote])));

  let fired = 0;
  for (const alert of due) {
    // Conditional on still being armed: a concurrent or repeated run matches
    // zero rows here and skips the notification instead of sending a second.
    const { data: claimed, error: claimError } = await supabase
      .from("watchlist")
      .update({ alert_triggered_at: new Date().toISOString() })
      .eq("id", alert.id)
      .is("alert_triggered_at", null)
      .select("id");
    if (claimError) {
      console.error(`Alert cron: could not mark ${alert.id} triggered`, claimError);
      continue;
    }
    if (!claimed?.length) continue;

    const { error: notifyError } = await supabase.from("notifications").insert({
      user_id: alert.user_id,
      kind: "PRICE_ALERT",
      ticker: alert.ticker,
      title: `${alert.ticker.replace(".NS", "")} reached ${alert.alert_price}`,
      body: "Today's trading range touched your alert level. Set a new level on the Watchlist to re-arm it.",
    });
    if (notifyError) {
      console.error(`Alert cron: notification for ${alert.id} failed`, notifyError);
      continue;
    }
    fired += 1;
  }

  return NextResponse.json({ market, armed: armed.length, quoted: quotes.length, fired });
}
