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
  investedValue: number;
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
  pnlPercent: number;
  dayChange: number;
  dayChangePercent: number;
  /** Tickers left out of the totals, and why -- shown, not silently dropped. */
  excluded: { ticker: string; reason: "no-quote" | "no-fx-rate" }[];
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
  quotes: Map<string, Pick<MarketQuote, "price" | "change">>,
  usdInr: number | null,
  base: Currency
): PortfolioSummary<H> {
  const rate = usdInr && usdInr > 0 ? usdInr : null;
  const toBase = (value: number, from: Currency): number | null => {
    if (from === base) return value;
    if (rate === null) return null;
    return from === "USD" ? value * rate : value / rate;
  };

  const excluded: PortfolioSummary["excluded"] = [];
  let invested = 0;
  let current = 0;
  let dayChange = 0;
  const sectorTotals = new Map<string, number>();
  const baseValues = new Map<string, number>();

  const rows: SummaryRow<H>[] = holdings.map((holding) => {
    const currency = currencyOf(holding.exchange);
    const investedValue = holding.quantity * holding.avg_buy_price;
    const quote = quotes.get(holding.ticker);
    const price = quote && Number.isFinite(quote.price) && quote.price > 0 ? quote.price : null;

    if (price === null) {
      excluded.push({ ticker: holding.ticker, reason: "no-quote" });
      return {
        holding, currency, investedValue, price: null, currentValue: null,
        pnl: null, pnlPercent: null, dayChange: null, dayChangePercent: null, weight: null,
      };
    }

    const currentValue = holding.quantity * price;
    const change = Number.isFinite(quote?.change) ? (quote?.change ?? 0) : 0;
    const rowDay = holding.quantity * change;
    const previous = currentValue - rowDay;

    const investedBase = toBase(investedValue, currency);
    const currentBase = toBase(currentValue, currency);
    const dayBase = toBase(rowDay, currency);
    if (investedBase === null || currentBase === null || dayBase === null) {
      excluded.push({ ticker: holding.ticker, reason: "no-fx-rate" });
    } else {
      invested += investedBase;
      current += currentBase;
      dayChange += dayBase;
      baseValues.set(holding.id, currentBase);
      const sector = holding.sector || "Unclassified";
      sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + currentBase);
    }

    return {
      holding,
      currency,
      investedValue,
      price,
      currentValue,
      pnl: currentValue - investedValue,
      pnlPercent: investedValue > 0 ? ((currentValue - investedValue) / investedValue) * 100 : null,
      dayChange: rowDay,
      dayChangePercent: previous > 0 ? (rowDay / previous) * 100 : null,
      weight: null,
    };
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
  return {
    base,
    usdInr: rate,
    rows,
    invested,
    current,
    pnl: current - invested,
    pnlPercent: invested > 0 ? ((current - invested) / invested) * 100 : 0,
    dayChange,
    dayChangePercent: previousTotal > 0 ? (dayChange / previousTotal) * 100 : 0,
    excluded,
    sectors,
    largestPosition: largest && largest.weight !== null ? { ticker: largest.holding.ticker, weight: largest.weight } : null,
  };
}
