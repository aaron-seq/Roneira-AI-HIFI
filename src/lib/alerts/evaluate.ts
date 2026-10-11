import type { MarketQuote } from "@/lib/market/types";

export type Market = "india" | "us";

export interface ArmedAlert {
  id: string;
  user_id: string;
  ticker: string;
  exchange: string;
  alert_price: number;
  alert_revision: number;
  alert_armed_at: string;
}

type AlertQuote = Pick<MarketQuote, "price" | "high" | "low" | "previousClose" | "timestamp"> & {
  sessionDate?: string | null;
  sessionTimezone?: string | null;
};

const MARKET_TIMEZONE: Record<Market, string> = {
  india: "Asia/Kolkata",
  us: "America/New_York",
};

/** Calendar date in the exchange's timezone, rather than the server's UTC day. */
export function marketSessionDate(market: Market, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIMEZONE[market],
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * A previous session's high/low must not trigger a newly armed alert on a
 * holiday, weekend, or provider outage. Daily bars carry a session date;
 * intraday quotes carry the provider's actual as-of timestamp. Receipt time
 * cannot establish either one.
 */
function isCurrentSession(quote: AlertQuote, market: Market, now: Date): boolean {
  const expectedDate = marketSessionDate(market, now);
  if (quote.sessionDate != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(quote.sessionDate)) return false;
    // Session dates are provider exchange-local bar labels. The known market
    // supplies the timezone when the provider omits its exchange timezone.
    if (quote.sessionDate !== expectedDate) return false;
  } else if (!quote.timestamp) {
    return false;
  }

  if (quote.timestamp) {
    const asOf = new Date(quote.timestamp);
    if (!Number.isFinite(asOf.getTime()) || asOf.getTime() > now.getTime()) return false;
    // A provider timestamp overrides a date label that might be stale or
    // inconsistent with the actual quote.
    if (marketSessionDate(market, asOf) !== expectedDate) return false;
  }
  return true;
}

function rangeSinceArming(alert: ArmedAlert, quote: AlertQuote, now: Date): [number, number] | null {
  const armedAt = new Date(alert.alert_armed_at);
  if (!Number.isFinite(armedAt.getTime()) || armedAt.getTime() > now.getTime()) return null;
  const market = marketOf(alert.exchange);
  const armedDate = marketSessionDate(market, armedAt);
  const sessionDate = marketSessionDate(market, now);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIMEZONE[market], hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(armedAt);
  const hour = Number(parts.find((item) => item.type === "hour")?.value);
  const minute = Number(parts.find((item) => item.type === "minute")?.value);
  const sessionOpen = market === "india" ? 9 * 60 + 15 : 9 * 60 + 30;
  if (armedDate < sessionDate || (armedDate === sessionDate && hour * 60 + minute < sessionOpen)) {
    return sessionRange(quote);
  }

  // Today's full high/low may have happened before an intraday or after-close
  // re-arm. Only an actual post-arm quote can prove a new touch; daily bar
  // labels do not supply an as-of time and must wait until the next session.
  const asOf = quote.timestamp ? new Date(quote.timestamp).getTime() : Number.NaN;
  if (!Number.isFinite(asOf) || asOf < armedAt.getTime()) return null;
  if (!Number.isFinite(quote.price) || quote.price <= 0) return null;
  return [quote.price, quote.price];
}

export function marketOf(exchange: string): Market {
  return exchange === "NSE" || exchange === "BSE" ? "india" : "us";
}

/**
 * The price range the session covered, or null if the quote cannot say.
 *
 * High/low first: a level touched at 11:00 and left by the close still counts,
 * which is the point of evaluating once after the close (ADR 0001). Without a
 * range, the quote can only vouch for its last traded price.
 */
export function sessionRange(
  quote: Pick<MarketQuote, "price" | "high" | "low" | "previousClose">
): [number, number] | null {
  const finite = (value: number | null | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
  if (finite(quote.low) && finite(quote.high) && quote.low <= quote.high) return [quote.low, quote.high];
  // The previous close is not part of today's trading range: a gap can jump
  // over an alert level without any trade touching it. A last price can only
  // establish that the last price itself was reached.
  if (finite(quote.price)) return [quote.price, quote.price];
  return null;
}

/**
 * Alerts whose level the session touched, capped per user so one long
 * watchlist on a volatile day cannot flood a single inbox.
 */
export function dueAlerts<A extends ArmedAlert>(
  alerts: A[],
  quotes: Map<string, AlertQuote>,
  perUserCap = 20,
  now = new Date()
): A[] {
  const perUser = new Map<string, number>();
  const due: A[] = [];
  for (const alert of alerts) {
    const quote = quotes.get(alert.ticker);
    if (!Number.isFinite(alert.alert_price) || alert.alert_price <= 0) continue;
    if (!quote || !isCurrentSession(quote, marketOf(alert.exchange), now)) continue;
    const range = rangeSinceArming(alert, quote, now);
    if (!range || alert.alert_price < range[0] || alert.alert_price > range[1]) continue;
    const count = perUser.get(alert.user_id) ?? 0;
    if (count >= perUserCap) continue;
    perUser.set(alert.user_id, count + 1);
    due.push(alert);
  }
  return due;
}
