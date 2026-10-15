import type { MarketQuote, QuoteConfig } from "@/lib/market/types";
import type { PortfolioSummary } from "@/lib/portfolio/summary";
import { formatCurrency } from "@/lib/utils";

export interface InsightStory {
  id: string;
  title: string;
  body: string;
}

export interface InsightStories {
  stories: InsightStory[];
  sourceNote: string;
  methodology: string[];
}

const REGIONS = [
  { id: "india", name: "India" },
  { id: "us", name: "United States" },
  { id: "europe", name: "Europe" },
] as const;

const PROVIDERS: Record<MarketQuote["provider"], string> = {
  "twelve-data": "Twelve Data",
  yfinance: "Yahoo Finance",
};

function validPrice(quote: MarketQuote) {
  return Number.isFinite(quote.price) && quote.price > 0;
}

function uniqueQuotes(quotes: readonly MarketQuote[]) {
  const result = new Map<string, MarketQuote>();
  for (const quote of quotes) {
    if (validPrice(quote) && !result.has(quote.symbol)) result.set(quote.symbol, quote);
  }
  return result;
}

function validSessionDate(value?: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function providerTime(value: string | null) {
  // A date without a clock or timezone is a session label, not an as-of time.
  if (!value || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    || !validSessionDate(value.slice(0, 10))) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function range(values: string[]) {
  const ordered = Array.from(new Set(values)).sort();
  return ordered.length === 1 ? ordered[0] : `${ordered[0]} to ${ordered[ordered.length - 1]}`;
}

function sourceNote(quotes: MarketQuote[]) {
  if (quotes.length === 0) return "Provider times and exchange session dates are unavailable.";

  const providers = Array.from(new Set(quotes.map((quote) => PROVIDERS[quote.provider] ?? "Unknown provider"))).sort();
  const times = quotes.map((quote) => providerTime(quote.timestamp)).filter((value): value is string => value !== null);
  const sessions = quotes.map((quote) => quote.sessionDate).filter(validSessionDate);
  const zones = Array.from(new Set(quotes
    .filter((quote) => validSessionDate(quote.sessionDate))
    .map((quote) => quote.sessionTimezone).filter((value): value is string => Boolean(value)))).sort();
  const parts = [`Sources: ${providers.join(", ")}.`];

  if (times.length) {
    parts.push(`Provider as-of: ${range(times.map((time) => time.replace("T", " ").replace(/\.\d{3}Z$/, " UTC")))}.`);
  }
  if (times.length < quotes.length) {
    parts.push(`${quotes.length - times.length} of ${quotes.length} quotes have no provider as-of time.`);
  }
  if (sessions.length) {
    parts.push(`Exchange sessions: ${range(sessions)}${zones.length ? ` (${zones.join(", ")})` : " (timezone unavailable)"}.`);
  }
  if (sessions.length < quotes.length) {
    parts.push(`${quotes.length - sessions.length} of ${quotes.length} quotes have no exchange session date.`);
  }
  const unknownZones = quotes.filter((quote) => validSessionDate(quote.sessionDate) && !quote.sessionTimezone).length;
  if (unknownZones > 0 && zones.length > 0) {
    parts.push(`${unknownZones} dated quotes have no session timezone.`);
  }
  return parts.join(" ");
}

/** Describes the configured index sample; this is not constituent-stock breadth. */
export function buildMarketStories({ configs, quotes }: {
  configs: readonly QuoteConfig[];
  quotes: readonly MarketQuote[];
}): InsightStories {
  const indices = Array.from(new Map(configs
    .filter((config) => config.assetType === "index" && REGIONS.some((region) => region.id === config.region))
    .map((config) => [config.symbol, config])).values());
  const quotesBySymbol = uniqueQuotes(quotes);
  const observed = indices.map((config) => quotesBySymbol.get(config.symbol))
    .filter((quote): quote is MarketQuote => Boolean(quote));
  const stories: InsightStory[] = [{
    id: "market-coverage",
    title: "Tracked index coverage",
    body: indices.length
      ? `${observed.length} of ${indices.length} tracked regional indices have a usable price. ${indices.length - observed.length} have no usable quote.`
      : "No regional indices are configured for this view.",
  }];

  for (const region of REGIONS) {
    const configured = indices.filter((config) => config.region === region.id);
    if (configured.length === 0) continue;
    const compared = configured.map((config) => quotesBySymbol.get(config.symbol)).filter(
      (quote): quote is MarketQuote => Boolean(quote && quote.changePercentAvailable === true && Number.isFinite(quote.changePercent))
    );
    const higher = compared.filter((quote) => quote.changePercent > 0).length;
    const lower = compared.filter((quote) => quote.changePercent < 0).length;
    const unchanged = compared.length - higher - lower;

    stories.push({
      id: `market-${region.id}`,
      title: `${region.name}: tracked index movement`,
      body: compared.length
        ? `${higher} higher, ${lower} lower, and ${unchanged} unchanged compared with provider previous closes. Comparisons are available for ${compared.length} of ${configured.length} tracked indices.`
        : `Previous-close comparisons are unavailable for all ${configured.length} tracked indices. A quoted price alone does not establish a gain or loss.`,
    });
  }

  return {
    stories,
    sourceNote: sourceNote(observed),
    methodology: [
      "Movement counts use observed percentage changes. Unchanged means an observed zero; missing comparisons are excluded.",
      "The sample contains configured India, United States, and Europe indices. These indices overlap; counts describe this tracked sample, not all stocks or full-market breadth. Volatility, yield, and currency indicators are excluded.",
      "Comparisons use each provider's previous close and may represent different exchange sessions. Provider as-of times and exchange session dates are shown separately; a page refresh does not establish quote freshness.",
    ],
  };
}

/** Describes the existing summary's priced, convertible subset without revaluing it. */
export function buildPortfolioStories({ summary, quotes }: {
  summary: PortfolioSummary;
  quotes: readonly MarketQuote[];
}): InsightStories {
  const included = summary.rows.filter((row) => row.weight !== null && Number.isFinite(row.weight)
    && row.price !== null && Number.isFinite(row.price) && row.price > 0
    && row.currentValue !== null && Number.isFinite(row.currentValue) && row.currentValue > 0);
  const relevant = new Set(summary.rows.map((row) => row.holding.ticker));
  const foreign = included.some((row) => row.currency !== summary.base);
  if (foreign) relevant.add("USDINR=X");
  const observed = Array.from(uniqueQuotes(quotes).values()).filter((quote) => relevant.has(quote.symbol));
  const noQuote = summary.excluded.filter((row) => row.reason === "no-quote").length;
  const noFx = summary.excluded.filter((row) => row.reason === "no-fx-rate").length;
  const invalidHolding = summary.excluded.filter((row) => row.reason === "invalid-holding").length;
  const invalidValue = summary.excluded.filter((row) => row.reason === "invalid-value").length;
  const methodology = [
    "Coverage counts holdings, not the percentage of total portfolio value. Missing quotes, unavailable currency conversions, invalid holding inputs, and values that cannot be represented safely are excluded from aggregate valuation, profit or loss, and allocation weights.",
    "Unrealized profit or loss is marked value minus recorded cost for included holdings. It excludes fees, taxes, dividends, realized trades, and historical currency gains or losses.",
    "Position and sector weights divide included marked values by the priced, convertible book. Partial coverage does not establish concentration across the whole portfolio; sector labels come from your holdings.",
    "Provider as-of times and exchange session dates are shown separately. Quotes can describe different sessions; refreshing the page does not establish quote freshness.",
  ];
  if (foreign && summary.usdInr !== null && Number.isFinite(summary.usdInr) && summary.usdInr > 0) {
    methodology.push(`Foreign holdings and their cost basis use the same supplied current rate of ${formatCurrency(summary.usdInr, "INR")} per USD. Historical purchase-date FX rates are unavailable.`);
  }
  if (summary.rows.length === 0) {
    return {
      stories: [{ id: "portfolio-empty", title: "No holdings yet", body: "Add a holding to see valuation coverage, concentration, and unrealized profit or loss." }],
      sourceNote: sourceNote([]),
      methodology,
    };
  }

  const stories: InsightStory[] = [{
    id: "portfolio-coverage",
    title: "Valuation coverage",
    body: `${included.length} of ${summary.rows.length} holdings are included in the ${summary.base} valuation. ${noQuote} lack a usable quote; ${noFx} lack a usable currency conversion.${invalidHolding ? ` ${invalidHolding} have invalid holding inputs.` : ""}${invalidValue ? ` ${invalidValue} cannot be valued safely.` : ""}`,
  }];
  const totalsKnown = included.length > 0 && Number.isFinite(summary.current) && summary.current > 0
    && Number.isFinite(summary.invested) && summary.invested >= 0 && Number.isFinite(summary.pnl);
  if (!totalsKnown) {
    stories.push({ id: "portfolio-unavailable", title: "Valuation unavailable", body: "The available data does not support an aggregate value or profit or loss. Missing prices are not valued at their purchase prices." });
    return { stories, sourceNote: sourceNote(observed), methodology };
  }

  const result = summary.pnl > 0 ? "gain" : summary.pnl < 0 ? "loss" : "profit or loss";
  const percentage = summary.invested > 0 ? (Math.abs(summary.pnl) / summary.invested) * 100 : null;
  stories.push({
    id: "portfolio-pnl",
    title: "Unrealized profit or loss",
    body: `The priced, convertible book is valued at ${formatCurrency(summary.current, summary.base)}, with an unrealized ${result} of ${formatCurrency(Math.abs(summary.pnl), summary.base)}.${percentage !== null && Number.isFinite(percentage)
      ? ` This is ${percentage.toFixed(1)}% of its converted cost basis.`
      : summary.invested === 0
        ? " A percentage return is unavailable because the included cost basis is zero."
        : " A finite percentage return is unavailable for the supplied cost basis."}`,
  });

  const largest = summary.largestPosition;
  const topSector = summary.sectors.find((sector) => Number.isFinite(sector.weight) && sector.weight >= 0 && sector.weight <= 1);
  if (largest && Number.isFinite(largest.weight) && largest.weight >= 0 && largest.weight <= 1) {
    stories.push({
      id: "portfolio-concentration",
      title: "Largest exposure",
      body: `${largest.ticker} represents ${(largest.weight * 100).toFixed(1)}% of the priced, convertible book.${topSector
        ? topSector.sector === "Unclassified"
          ? ` Holdings without a sector label represent ${(topSector.weight * 100).toFixed(1)}% of that book.`
          : ` The largest sector, ${topSector.sector}, represents ${(topSector.weight * 100).toFixed(1)}% by marked value.`
        : ""}`,
    });
  }
  return { stories, sourceNote: sourceNote(observed), methodology };
}
