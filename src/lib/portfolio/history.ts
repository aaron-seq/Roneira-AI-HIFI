import type { MarketQuote } from "@/lib/market/types";
import { currencyOf, summarisePortfolio, type Currency, type HoldingInput } from "@/lib/portfolio/summary";

export const PORTFOLIO_HISTORY_METHODOLOGY = [
  "History starts with saved captures; earlier portfolio values are not reconstructed from today's holdings.",
  "Each currency has one capture per UTC calendar day. Saving again replaces that day's capture with the latest observed book.",
  "Values and cost basis include only holdings with usable quotes and currency conversion. Coverage and excluded holdings are recorded with each capture.",
  "Profit or loss is the captured value minus the included current holding cost basis, using the capture's FX rate. It excludes realized gains, cash flows, fees, dividends and historical FX effects.",
  "Changes between captures can include edited holdings and cost basis. They are changes in recorded portfolio value, not investment returns.",
  "Capture time is when this portfolio was saved; source timestamps and exchange sessions describe the market data and may be earlier.",
  "Holdings observation time identifies the editable book read before prices were fetched. Edits detected during capture require a retry; this is not an atomic broker ledger.",
] as const;

export type PortfolioSnapshotExclusion = {
  ticker: string;
  reason: "no-quote" | "no-fx-rate" | "invalid-holding" | "invalid-value" | "quote-currency-mismatch";
};

export interface PortfolioSnapshotSource {
  symbol: string;
  provider: MarketQuote["provider"];
  timestamp: string | null;
  sessionDate: string | null;
  sessionTimezone: string | null;
  usedFor: "holding" | "currency-conversion";
}

export interface PortfolioSnapshot {
  id: string;
  valuedOn: string;
  capturedAt: string;
  holdingsObservedAt: string;
  currency: Currency;
  investedValue: number | null;
  currentValue: number | null;
  pnl: number | null;
  pnlPercent: number | null;
  totalHoldings: number;
  pricedHoldings: number;
  coverageComplete: boolean;
  usdInr: number | null;
  exclusions: PortfolioSnapshotExclusion[];
  quoteSources: PortfolioSnapshotSource[];
}

export interface PortfolioHistory {
  currency: Currency;
  days: number;
  snapshots: PortfolioSnapshot[];
  methodology: readonly string[];
}

export type PortfolioCapture = Omit<PortfolioSnapshot, "id">;

function sourceOf(quote: MarketQuote, usedFor: PortfolioSnapshotSource["usedFor"]): PortfolioSnapshotSource {
  const timestamp = quote.timestamp !== null
    && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/i.test(quote.timestamp)
    && Number.isFinite(Date.parse(`${quote.timestamp.slice(0, 10)}T00:00:00Z`))
    && new Date(`${quote.timestamp.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) === quote.timestamp.slice(0, 10)
    && Number.isFinite(Date.parse(quote.timestamp))
    ? new Date(quote.timestamp).toISOString() : null;
  const sessionTime = Date.parse(`${quote.sessionDate}T00:00:00Z`);
  const sessionDate = quote.sessionDate && /^\d{4}-\d{2}-\d{2}$/.test(quote.sessionDate)
    && Number.isFinite(sessionTime) && new Date(sessionTime).toISOString().slice(0, 10) === quote.sessionDate
    ? quote.sessionDate : null;
  return {
    symbol: quote.symbol,
    provider: quote.provider,
    timestamp,
    sessionDate,
    sessionTimezone: quote.sessionTimezone ?? null,
    usedFor,
  };
}

/** A capture values the observed current book; it never invents past positions. */
export function buildPortfolioCapture(
  holdings: HoldingInput[],
  quotes: MarketQuote[],
  currency: Currency,
  capturedAt: Date,
  holdingsObservedAt: Date = capturedAt,
): PortfolioCapture {
  const captured = capturedAt.toISOString();
  const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const usableQuotes = new Map(quoteMap);
  const mismatched = new Set<string>();
  for (const holding of holdings) {
    const quote = quoteMap.get(holding.ticker);
    if (quote && quote.currency !== currencyOf(holding.exchange)) {
      usableQuotes.delete(holding.ticker);
      mismatched.add(holding.ticker);
    }
  }
  const fx = quoteMap.get("USDINR=X");
  const fxRate = fx?.currency === "INR" ? fx.price : null;
  const summary = summarisePortfolio(holdings, usableQuotes, fxRate, currency);
  const included = summary.rows.filter((row) => row.weight !== null);
  const knownTotals = holdings.length === 0 || included.length > 0;
  const sources = included.map((row) => sourceOf(quoteMap.get(row.holding.ticker)!, "holding"));
  if (fx && included.some((row) => row.currency !== currency)) {
    sources.push(sourceOf(fx, "currency-conversion"));
  }
  return {
    valuedOn: captured.slice(0, 10),
    capturedAt: captured,
    holdingsObservedAt: holdingsObservedAt.toISOString(),
    currency,
    investedValue: knownTotals ? summary.invested : null,
    currentValue: knownTotals ? summary.current : null,
    pnl: knownTotals ? summary.pnl : null,
    pnlPercent: knownTotals ? summary.pnlPercent : null,
    totalHoldings: holdings.length,
    pricedHoldings: included.length,
    coverageComplete: holdings.length === included.length,
    usdInr: summary.usdInr,
    exclusions: summary.excluded.map((excluded) => ({
      ...excluded,
      reason: excluded.reason === "no-quote" && mismatched.has(excluded.ticker)
        ? "quote-currency-mismatch" : excluded.reason,
    })),
    quoteSources: Array.from(new Map(sources.map((source) => [`${source.usedFor}:${source.symbol}`, source])).values()),
  };
}
