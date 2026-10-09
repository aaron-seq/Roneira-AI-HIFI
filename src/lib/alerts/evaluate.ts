import type { MarketQuote } from "@/lib/market/types";

export type Market = "india" | "us";

export interface ArmedAlert {
  id: string;
  user_id: string;
  ticker: string;
  exchange: string;
  alert_price: number;
}

export function marketOf(exchange: string): Market {
  return exchange === "NSE" || exchange === "BSE" ? "india" : "us";
}

/**
 * The price range the session covered, or null if the quote cannot say.
 *
 * High/low first: a level touched at 11:00 and left by the close still counts,
 * which is the point of evaluating once after the close (ADR 0001). Without a
 * range, the move from the previous close to the last price is the most the
 * quote can vouch for.
 */
export function sessionRange(
  quote: Pick<MarketQuote, "price" | "high" | "low" | "previousClose">
): [number, number] | null {
  const finite = (value: number | null | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
  if (finite(quote.low) && finite(quote.high)) return [quote.low, quote.high];
  if (finite(quote.previousClose) && finite(quote.price)) {
    return [Math.min(quote.previousClose, quote.price), Math.max(quote.previousClose, quote.price)];
  }
  return null;
}

/**
 * Alerts whose level the session touched, capped per user so one long
 * watchlist on a volatile day cannot flood a single inbox.
 */
export function dueAlerts<A extends ArmedAlert>(
  alerts: A[],
  quotes: Map<string, Pick<MarketQuote, "price" | "high" | "low" | "previousClose">>,
  perUserCap = 20
): A[] {
  const perUser = new Map<string, number>();
  const due: A[] = [];
  for (const alert of alerts) {
    const quote = quotes.get(alert.ticker);
    const range = quote ? sessionRange(quote) : null;
    if (!range || alert.alert_price < range[0] || alert.alert_price > range[1]) continue;
    const count = perUser.get(alert.user_id) ?? 0;
    if (count >= perUserCap) continue;
    perUser.set(alert.user_id, count + 1);
    due.push(alert);
  }
  return due;
}
