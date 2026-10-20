import type { PortfolioCapture, PortfolioSnapshot, PortfolioSnapshotExclusion, PortfolioSnapshotSource } from "@/lib/portfolio/history";
import type { Currency, HoldingInput } from "@/lib/portfolio/summary";

export const MAX_CAPTURE_HOLDINGS = 200;
export const SNAPSHOT_COLUMNS = "id, valuation_date, captured_at, holdings_observed_at, currency, invested_value, current_value, pnl, pnl_percent, total_holdings, priced_holdings, coverage_complete, usd_inr, exclusions, quote_sources";
export const HOLDING_COLUMNS = "id, ticker, exchange, quantity, avg_buy_price, sector, updated_at";

export type CaptureHolding = HoldingInput & { updated_at: string };

export interface PortfolioSnapshotRow {
  id: string;
  valuation_date: string;
  captured_at: string;
  holdings_observed_at: string;
  currency: Currency;
  invested_value: number | string | null;
  current_value: number | string | null;
  pnl: number | string | null;
  pnl_percent: number | string | null;
  total_holdings: number;
  priced_holdings: number;
  coverage_complete: boolean;
  usd_inr: number | string | null;
  exclusions: PortfolioSnapshotExclusion[];
  quote_sources: PortfolioSnapshotSource[];
}

function finiteValue(value: number | string | null): number | null {
  if (value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("Invalid stored portfolio valuation");
  return number;
}

export function snapshotFromRow(row: PortfolioSnapshotRow): PortfolioSnapshot {
  return {
    id: row.id,
    valuedOn: row.valuation_date,
    capturedAt: row.captured_at,
    holdingsObservedAt: row.holdings_observed_at,
    currency: row.currency,
    investedValue: finiteValue(row.invested_value),
    currentValue: finiteValue(row.current_value),
    pnl: finiteValue(row.pnl),
    pnlPercent: finiteValue(row.pnl_percent),
    totalHoldings: row.total_holdings,
    pricedHoldings: row.priced_holdings,
    coverageComplete: row.coverage_complete,
    usdInr: finiteValue(row.usd_inr),
    exclusions: row.exclusions,
    quoteSources: row.quote_sources,
  };
}

export function captureToRow(capture: PortfolioCapture, userId: string) {
  return {
    user_id: userId,
    valuation_date: capture.valuedOn,
    captured_at: capture.capturedAt,
    holdings_observed_at: capture.holdingsObservedAt,
    currency: capture.currency,
    invested_value: capture.investedValue,
    current_value: capture.currentValue,
    pnl_percent: capture.pnlPercent,
    total_holdings: capture.totalHoldings,
    priced_holdings: capture.pricedHoldings,
    coverage_complete: capture.coverageComplete,
    usd_inr: capture.usdInr,
    exclusions: capture.exclusions,
    quote_sources: capture.quoteSources,
  };
}

/** Sorting includes ID, so a row reorder cannot spuriously look like an edit. */
export function holdingsFingerprint(holdings: CaptureHolding[]): string {
  return JSON.stringify([...holdings].sort((left, right) => left.id.localeCompare(right.id)));
}

export function historyStartDate(now: Date, days: number): string {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString().slice(0, 10);
}
