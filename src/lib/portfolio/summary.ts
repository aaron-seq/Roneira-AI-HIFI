import type { MarketQuote } from "@/lib/market/types";

export type Currency = "INR" | "USD";

/** Holdings carry an exchange, not a currency; the schema allows only these four. */
export function currencyOf(exchange: string): Currency {
  return exchange === "NSE" || exchange === "BSE" ? "INR" : "USD";
}

export interface HoldingInput {
  id: string;
  ticker: string;
  exchange: string;
  quantity: number;
  avg_buy_price: number;
  sector: string | null;
}

export interface SummaryRow<H extends HoldingInput = HoldingInput> {
  holding: H;
  currency: Currency;
  /** null when quantity, cost, or their product cannot be represented safely. */
  investedValue: number | null;
  /** null when there is no live quote -- never the buy price standing in for one. */
  price: number | null;
  currentValue: number | null;
  pnl: number | null;
  pnlPercent: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  /** Share of the priced, convertible book, in the base currency. */
  weight: number | null;
}

export interface PortfolioSummary<H extends HoldingInput = HoldingInput> {
  base: Currency;
  /** INR per USD used for conversion, or null if no rate was available. */
  usdInr: number | null;
  rows: SummaryRow<H>[];
  /** Totals in `base`, over holdings that have a quote and a usable FX rate. */
  invested: number;
  current: number;
  pnl: number;
  /** null when the included cost basis is zero or a finite percentage is unavailable. */
  pnlPercent: number | null;
  dayChange: number;
  dayChangePercent: number;
  /** Both day aggregates are usable only when this flag is true. */
  dayChangeAvailable: boolean;
  /** Tickers left out of the totals, and why -- shown, not silently dropped. */
  excluded: { ticker: string; reason: "no-quote" | "no-fx-rate" | "invalid-holding" | "invalid-value" }[];
  sectors: { sector: string; value: number; weight: number }[];
  largestPosition: { ticker: string; weight: number } | null;
}

/**
 * Portfolio totals that are honest about what they can and cannot know.
 *
 * Replaces inline arithmetic on the Portfolio page that (a) added rupee and
 * dollar holdings together as one number, (b) valued an unquoted holding at
 * its buy price, so it showed zero P&L as if that were a measurement, and
 * (c) displayed "Today's change" as 10% of total P&L -- not a day change at
 * all. Day change here is quantity x the quote's own `change`.
 */
export function summarisePortfolio<H extends HoldingInput>(
  holdings: H[],
  quotes: Map<string, Pick<MarketQuote, "price" | "change"> & Partial<Pick<MarketQuote, "changeAvailable">>>,
  usdInr: number | null,
  base: Currency
): PortfolioSummary<H> {
  const rate = usdInr !== null && Number.isFinite(usdInr) && usdInr > 0 ? usdInr : null;
  const toBase = (value: number, from: Currency): number | null => {
    if (from === base) return value;
    if (rate === null) return null;
    return from === "USD" ? value * rate : value / rate;
  };
  const percent = (change: number, previous: number): number | null => {
    if (!Number.isFinite(previous) || previous <= 0) return null;
    const value = (change / previous) * 100;
    return Number.isFinite(value) ? value : null;
  };

  const excluded: PortfolioSummary["excluded"] = [];
  let invested = 0;
  let current = 0;
  let dayChange = 0;
  let allDayChangesKnown = true;
  const sectorTotals = new Map<string, number>();
  const baseValues = new Map<string, number>();

  const rows: SummaryRow<H>[] = holdings.map((holding) => {
    const currency = currencyOf(holding.exchange);
    const quote = quotes.get(holding.ticker);
    const price = quote && Number.isFinite(quote.price) && quote.price > 0 ? quote.price : null;
    const row: SummaryRow<H> = {
      holding, currency, investedValue: null, price, currentValue: null,
      pnl: null, pnlPercent: null, dayChange: null, dayChangePercent: null, weight: null,
    };

    if (!Number.isFinite(holding.quantity) || holding.quantity <= 0
      || !Number.isFinite(holding.avg_buy_price) || holding.avg_buy_price < 0) {
      excluded.push({ ticker: holding.ticker, reason: "invalid-holding" });
      return row;
    }
    const investedValue = holding.quantity * holding.avg_buy_price;
    if (!Number.isFinite(investedValue) || (holding.avg_buy_price > 0 && investedValue === 0)) {
      excluded.push({ ticker: holding.ticker, reason: "invalid-holding" });
      return row;
    }
    row.investedValue = investedValue;

    if (price === null) {
      excluded.push({ ticker: holding.ticker, reason: "no-quote" });
      return row;
    }

    const currentValue = holding.quantity * price;
    if (!Number.isFinite(currentValue) || currentValue <= 0) {
      excluded.push({ ticker: holding.ticker, reason: "invalid-value" });
      return row;
    }
    row.currentValue = currentValue;
    row.pnl = currentValue - investedValue;
    row.pnlPercent = percent(row.pnl, investedValue);
    const change = quote?.change;
    const rowDay = quote?.changeAvailable !== false && typeof change === "number" && Number.isFinite(change)
      ? holding.quantity * change : null;
    if (rowDay !== null && Number.isFinite(rowDay)) {
      row.dayChange = rowDay;
      row.dayChangePercent = percent(rowDay, currentValue - rowDay);
    }

    if (currency !== base && rate === null) {
      excluded.push({ ticker: holding.ticker, reason: "no-fx-rate" });
      return row;
    }
    const investedBase = toBase(investedValue, currency);
    const currentBase = toBase(currentValue, currency);
    if (investedBase === null || currentBase === null
      || !Number.isFinite(investedBase) || !Number.isFinite(currentBase) || currentBase <= 0
      || (investedValue > 0 && investedBase === 0)
      || !Number.isFinite(invested + investedBase) || !Number.isFinite(current + currentBase)) {
      excluded.push({ ticker: holding.ticker, reason: "invalid-value" });
      return row;
    }
    invested += investedBase;
    current += currentBase;
    const dayBase = row.dayChange !== null ? toBase(row.dayChange, currency) : null;
    if (row.dayChangePercent === null || dayBase === null || !Number.isFinite(dayBase) || !Number.isFinite(dayChange + dayBase)) {
      allDayChangesKnown = false;
    } else {
      dayChange += dayBase;
    }
    baseValues.set(holding.id, currentBase);
    const sector = holding.sector || "Unclassified";
    sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + currentBase);
    return row;
  });

  for (const row of rows) {
    const value = baseValues.get(row.holding.id);
    row.weight = value !== undefined && current > 0 ? value / current : null;
  }

  const sectors = Array.from(sectorTotals, ([sector, value]) => ({
    sector,
    value,
    weight: current > 0 ? value / current : 0,
  })).sort((a, b) => b.value - a.value);

  const largest = rows.reduce<SummaryRow<H> | null>(
    (best, row) => (row.weight !== null && (best === null || row.weight > (best.weight ?? 0)) ? row : best),
    null
  );

  const previousTotal = current - dayChange;
  const dayPercent = percent(dayChange, previousTotal);
  return {
    base,
    usdInr: rate,
    rows,
    invested,
    current,
    pnl: current - invested,
    pnlPercent: percent(current - invested, invested),
    dayChange,
    dayChangePercent: dayPercent ?? 0,
    dayChangeAvailable: baseValues.size > 0 && allDayChangesKnown && dayPercent !== null,
    excluded,
    sectors,
    largestPosition: largest && largest.weight !== null ? { ticker: largest.holding.ticker, weight: largest.weight } : null,
  };
}
