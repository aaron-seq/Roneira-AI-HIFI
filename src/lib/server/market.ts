import {
  COMMODITIES_FOREX_SECTIONS,
  MARKET_OVERVIEW_SECTIONS,
  MARKET_OVERVIEW_SYMBOLS,
  MOVER_SYMBOL_LIST,
  createSymbolConfig,
  getPeerConfigs,
} from "@/lib/market/constants";
import type {
  CandlePoint,
  MarketQuote,
  QuoteConfig,
  StockSearchResult,
} from "@/lib/market/types";
import { getCachedValue } from "@/lib/server/cache";

const ML_BACKEND_URL =
  process.env.NEXT_PUBLIC_ML_BACKEND_URL || "http://localhost:8000";
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || "";
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || "";
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || "";

type JsonRecord = Record<string, unknown>;

const QUOTE_TTL_MS = 60_000;
const SEARCH_TTL_MS = 5 * 60_000;
const HISTORY_TTL_MS = 5 * 60_000;

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const sanitized = value.replace(/,/g, "");
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isUsEquitySymbol(symbol: string) {
  return !symbol.includes(".") && !symbol.startsWith("^") && !symbol.includes("=") && !symbol.endsWith("-USD");
}

function getProviderSymbol(config: QuoteConfig): string | undefined {
  if (config.providerSymbol) {
    return config.providerSymbol;
  }

  if (config.assetType === "equity" && isUsEquitySymbol(config.symbol)) {
    return config.symbol;
  }

  return undefined;
}

async function fetchJson(url: string): Promise<JsonRecord> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as JsonRecord;
}

function unwrapTwelveQuotePayload(payload: JsonRecord): Map<string, JsonRecord> {
  if (typeof payload.symbol === "string") {
    return new Map([[payload.symbol, payload]]);
  }

  return new Map(
    Object.entries(payload)
      .filter(([, value]) => typeof value === "object" && value !== null)
      .map(([symbol, value]) => [
        symbol,
        {
          symbol,
          ...(value as JsonRecord),
        },
      ])
  );
}

function normalizeQuote(
  config: QuoteConfig,
  raw: JsonRecord,
  provider: MarketQuote["provider"]
): MarketQuote | null {
  const price =
    toNumber(raw.close) ??
    toNumber(raw.price) ??
    toNumber(raw.last) ??
    toNumber(raw.value);

  if (price === null) {
    return null;
  }

  const previousClose =
    toNumber(raw.previous_close) ??
    toNumber(raw.prev_close) ??
    toNumber(raw.previousClose);
  const change =
    toNumber(raw.change) ??
    (previousClose !== null ? price - previousClose : 0);
  const changePercent =
    toNumber(raw.percent_change) ??
    toNumber(raw.change_percent) ??
    (previousClose ? (change / previousClose) * 100 : 0);

  return {
    symbol: config.symbol,
    name:
      (typeof raw.name === "string" && raw.name) ||
      (typeof raw.shortName === "string" && raw.shortName) ||
      config.name,
    exchange:
      (typeof raw.exchange === "string" && raw.exchange) || config.exchange,
    assetType: config.assetType,
    currency:
      (typeof raw.currency === "string" && raw.currency) || config.currency,
    price,
    change,
    changePercent,
    high: toNumber(raw.high),
    low: toNumber(raw.low),
    open: toNumber(raw.open),
    previousClose,
    volume: toNumber(raw.volume),
    provider,
    timestamp: new Date().toISOString(),
  };
}

async function fetchTwelveQuotes(
  configs: QuoteConfig[]
): Promise<Map<string, MarketQuote>> {
  if (!TWELVE_DATA_API_KEY) {
    return new Map();
  }

  const providerMap = new Map<string, QuoteConfig>();
  const providerSymbols = configs
    .map((config) => {
      const providerSymbol = getProviderSymbol(config);
      if (!providerSymbol) {
        return null;
      }

      providerMap.set(providerSymbol, config);
      return providerSymbol;
    })
    .filter((value): value is string => Boolean(value));

  if (providerSymbols.length === 0) {
    return new Map();
  }

  try {
    const payload = await fetchJson(
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(
        providerSymbols.join(",")
      )}&apikey=${TWELVE_DATA_API_KEY}`
    );
    const entries = unwrapTwelveQuotePayload(payload);
    const quotes = new Map<string, MarketQuote>();

    for (const [providerSymbol, entry] of entries) {
      const config = providerMap.get(providerSymbol);
      if (!config) {
        continue;
      }

      const normalized = normalizeQuote(config, entry, "twelve-data");
      if (normalized) {
        quotes.set(config.symbol, normalized);
      }
    }

    return quotes;
  } catch {
    return new Map();
  }
}

async function fetchMlQuotes(
  configs: QuoteConfig[]
): Promise<Map<string, MarketQuote>> {
  if (configs.length === 0) {
    return new Map();
  }

  const fallbackSymbols = configs.map(
    (config) => config.fallbackSymbol ?? config.symbol
  );

  const payload = await fetchJson(
    `${ML_BACKEND_URL}/market-data?symbols=${encodeURIComponent(
      fallbackSymbols.join(",")
    )}`
  );

  const rows = Array.isArray(payload.data)
    ? (payload.data as JsonRecord[])
    : [];
  const mlBySymbol = new Map(
    rows
      .map((row) => {
        const symbol = typeof row.symbol === "string" ? row.symbol : null;
        return symbol ? [symbol, row] : null;
      })
      .filter((row): row is [string, JsonRecord] => Boolean(row))
  );

  const quotes = new Map<string, MarketQuote>();
  for (const config of configs) {
    const raw = mlBySymbol.get(config.fallbackSymbol ?? config.symbol);
    if (!raw) {
      continue;
    }

    const normalized = normalizeQuote(config, raw, "yfinance");
    if (normalized) {
      quotes.set(config.symbol, normalized);
    }
  }

  return quotes;
}

export async function getNormalizedQuotes(
  configs: QuoteConfig[],
  ttlMs = QUOTE_TTL_MS
): Promise<MarketQuote[]> {
  const uniqueConfigs = Array.from(
    new Map(configs.map((config) => [config.symbol, config])).values()
  );

  return getCachedValue(
    `quotes:${uniqueConfigs.map((config) => config.symbol).join(",")}`,
    ttlMs,
    async () => {
      const twelveQuotes = await fetchTwelveQuotes(uniqueConfigs);
      const missing = uniqueConfigs.filter(
        (config) => !twelveQuotes.has(config.symbol)
      );
      const fallbackQuotes = await fetchMlQuotes(missing);

      return uniqueConfigs
        .map((config) => twelveQuotes.get(config.symbol) ?? fallbackQuotes.get(config.symbol))
        .filter((quote): quote is MarketQuote => Boolean(quote));
    }
  );
}

function mapSectionQuotes(
  section: readonly QuoteConfig[],
  quotesBySymbol: Map<string, MarketQuote>
) {
  return section
    .map((config) => quotesBySymbol.get(config.symbol))
    .filter((quote): quote is MarketQuote => Boolean(quote));
}

export async function getMarketOverviewPayload() {
  const [overviewQuotes, moverQuotes] = await Promise.all([
    getNormalizedQuotes(MARKET_OVERVIEW_SYMBOLS),
    getNormalizedQuotes(MOVER_SYMBOL_LIST),
  ]);

  const overviewMap = new Map(
    overviewQuotes.map((quote) => [quote.symbol, quote])
  );
  const movers = [...moverQuotes].sort(
    (left, right) => right.changePercent - left.changePercent
  );

  return {
    data: overviewQuotes,
    sections: {
      india: mapSectionQuotes(MARKET_OVERVIEW_SECTIONS.india, overviewMap),
      us: mapSectionQuotes(MARKET_OVERVIEW_SECTIONS.us, overviewMap),
      europe: mapSectionQuotes(MARKET_OVERVIEW_SECTIONS.europe, overviewMap),
      special: mapSectionQuotes(MARKET_OVERVIEW_SECTIONS.special, overviewMap),
    },
    movers: {
      gainers: movers.slice(0, 5),
      losers: [...movers].reverse().slice(0, 5),
    },
    timestamp: new Date().toISOString(),
  };
}

export async function getCommoditiesForexPayload() {
  const configs = [
    ...COMMODITIES_FOREX_SECTIONS.commodities,
    ...COMMODITIES_FOREX_SECTIONS.forex,
    ...COMMODITIES_FOREX_SECTIONS.crypto,
  ];
  const quotes = await getNormalizedQuotes(configs);
  const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));

  return {
    data: quotes,
    sections: {
      commodities: mapSectionQuotes(
        COMMODITIES_FOREX_SECTIONS.commodities,
        quoteMap
      ),
      forex: mapSectionQuotes(COMMODITIES_FOREX_SECTIONS.forex, quoteMap),
      crypto: mapSectionQuotes(COMMODITIES_FOREX_SECTIONS.crypto, quoteMap),
    },
    timestamp: new Date().toISOString(),
  };
}

export async function getPeerComparisonPayload(symbol: string) {
  const peers = getPeerConfigs(symbol);
  const quotes = await getNormalizedQuotes(peers);
  return {
    peers: quotes,
    timestamp: new Date().toISOString(),
  };
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  return getCachedValue(`search:${query.toLowerCase()}`, SEARCH_TTL_MS, async () => {
    if (!query.trim()) {
      return [];
    }

    if (FINNHUB_API_KEY) {
      try {
        const payload = await fetchJson(
          `https://finnhub.io/api/v1/search?q=${encodeURIComponent(
            query
          )}&token=${FINNHUB_API_KEY}`
        );
        const rows = Array.isArray(payload.result)
          ? (payload.result as JsonRecord[])
          : [];
        const mapped = rows
          .filter(
            (row) =>
              row.type === "Common Stock" ||
              row.type === "ETP" ||
              row.type === "ADR"
          )
          .slice(0, 8)
          .map((row) => ({
            symbol: String(row.symbol || ""),
            name: String(row.description || row.symbol || ""),
            exchange:
              typeof row.symbol === "string" && row.symbol.endsWith(".NS")
                ? "NSE"
                : typeof row.symbol === "string" && row.symbol.endsWith(".BO")
                  ? "BSE"
                  : "NASDAQ",
            type: String(row.type || "Equity"),
            provider: "finnhub" as const,
          }))
          .filter((row) => row.symbol.length > 0);

        if (mapped.length > 0) {
          return mapped;
        }
      } catch {
        // Fall back to Alpha Vantage below.
      }
    }

    if (!ALPHA_VANTAGE_API_KEY) {
      return [];
    }

    try {
      const payload = await fetchJson(
        `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(
          query
        )}&apikey=${ALPHA_VANTAGE_API_KEY}`
      );
      const rows = Array.isArray(payload.bestMatches)
        ? (payload.bestMatches as JsonRecord[])
        : [];
      return rows.slice(0, 8).map((row) => ({
        symbol: String(row["1. symbol"] || ""),
        name: String(row["2. name"] || row["1. symbol"] || ""),
        exchange: String(row["4. region"] || "NASDAQ"),
        type: String(row["3. type"] || "Equity"),
        currency:
          typeof row["8. currency"] === "string"
            ? row["8. currency"]
            : undefined,
        provider: "alpha-vantage" as const,
      }));
    } catch {
      return [];
    }
  });
}

function getHistoryOutputSize(range: string) {
  switch (range) {
    case "1month":
      return 30;
    case "3month":
      return 90;
    case "6month":
      return 180;
    case "1year":
      return 365;
    default:
      return 120;
  }
}

async function fetchTwelveHistory(
  config: QuoteConfig,
  interval: string,
  range: string
): Promise<CandlePoint[]> {
  const providerSymbol = getProviderSymbol(config);
  if (!TWELVE_DATA_API_KEY || !providerSymbol) {
    return [];
  }

  try {
    const payload = await fetchJson(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
        providerSymbol
      )}&interval=${encodeURIComponent(
        interval
      )}&outputsize=${getHistoryOutputSize(range)}&timezone=UTC&apikey=${TWELVE_DATA_API_KEY}`
    );
    const values = Array.isArray(payload.values)
      ? (payload.values as JsonRecord[])
      : [];

    return values
      .map((value) => {
        const time =
          (typeof value.datetime === "string" && value.datetime) ||
          (typeof value.date === "string" && value.date) ||
          null;
        const open = toNumber(value.open);
        const high = toNumber(value.high);
        const low = toNumber(value.low);
        const close = toNumber(value.close);
        const volume = toNumber(value.volume) ?? 0;

        if (!time || open === null || high === null || low === null || close === null) {
          return null;
        }

        return {
          time,
          open,
          high,
          low,
          close,
          volume,
        };
      })
      .filter((value): value is CandlePoint => Boolean(value))
      .reverse();
  } catch {
    return [];
  }
}

async function fetchMlHistory(
  config: QuoteConfig,
  interval: string,
  range: string
): Promise<CandlePoint[]> {
  const payload = await fetchJson(
    `${ML_BACKEND_URL}/history?symbol=${encodeURIComponent(
      config.fallbackSymbol ?? config.symbol
    )}&interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(
      range
    )}`
  );
  const rows = Array.isArray(payload.candles)
    ? (payload.candles as JsonRecord[])
    : [];

  return rows
    .map((value) => {
      const time = typeof value.time === "string" ? value.time : null;
      const open = toNumber(value.open);
      const high = toNumber(value.high);
      const low = toNumber(value.low);
      const close = toNumber(value.close);
      const volume = toNumber(value.volume) ?? 0;

      if (!time || open === null || high === null || low === null || close === null) {
        return null;
      }

      return {
        time,
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter((value): value is CandlePoint => Boolean(value));
}

export async function getQuoteHistory(
  symbol: string,
  interval = "1day",
  range = "6month"
): Promise<CandlePoint[]> {
  const config = createSymbolConfig(symbol);
  return getCachedValue(
    `history:${config.symbol}:${interval}:${range}`,
    HISTORY_TTL_MS,
    async () => {
      const twelveHistory = await fetchTwelveHistory(config, interval, range);
      if (twelveHistory.length > 0) {
        return twelveHistory;
      }

      return fetchMlHistory(config, interval, range);
    }
  );
}
