import type { QuoteConfig } from "@/lib/market/types";

const INDIA_INDICES: QuoteConfig[] = [
  { symbol: "^NSEI", name: "NIFTY 50", exchange: "NSE", assetType: "index", currency: "INR", region: "india" },
  { symbol: "^BSESN", name: "SENSEX", exchange: "BSE", assetType: "index", currency: "INR", region: "india" },
  { symbol: "^NSEBANK", name: "NIFTY Bank", exchange: "NSE", assetType: "index", currency: "INR", region: "india" },
  { symbol: "^CNXMIDCAP", name: "NIFTY Midcap", exchange: "NSE", assetType: "index", currency: "INR", region: "india" },
];

const US_INDICES: QuoteConfig[] = [
  { symbol: "^IXIC", name: "NASDAQ", exchange: "NASDAQ", assetType: "index", currency: "USD", region: "us" },
  { symbol: "^NYA", name: "NYSE Composite", exchange: "NYSE", assetType: "index", currency: "USD", region: "us" },
  { symbol: "^GSPC", name: "S&P 500", exchange: "NYSE", assetType: "index", currency: "USD", region: "us" },
  { symbol: "^DJI", name: "Dow Jones", exchange: "NYSE", assetType: "index", currency: "USD", region: "us" },
];

const EUROPE_INDICES: QuoteConfig[] = [
  { symbol: "^FTSE", name: "FTSE 100", exchange: "LSE", assetType: "index", currency: "GBP", region: "europe" },
  { symbol: "^GDAXI", name: "DAX", exchange: "XETRA", assetType: "index", currency: "EUR", region: "europe" },
  { symbol: "^FCHI", name: "CAC 40", exchange: "EURONEXT", assetType: "index", currency: "EUR", region: "europe" },
  { symbol: "^STOXX50E", name: "Euro Stoxx 50", exchange: "STOXX", assetType: "index", currency: "EUR", region: "europe" },
];

const SPECIAL_MARKETS: QuoteConfig[] = [
  { symbol: "^INDIAVIX", name: "India VIX", exchange: "NSE", assetType: "volatility", currency: "INR", region: "special" },
  { symbol: "^VIX", name: "CBOE VIX", exchange: "CBOE", assetType: "volatility", currency: "USD", region: "special" },
  { symbol: "^TNX", name: "US 10Y Yield", exchange: "NYSE", assetType: "yield", currency: "USD", region: "special" },
  { symbol: "DX-Y.NYB", name: "US Dollar Index", exchange: "ICE", assetType: "index", currency: "USD", region: "special" },
];

const COMMODITIES: QuoteConfig[] = [
  { symbol: "GC=F", name: "Gold", exchange: "COMEX", assetType: "commodity", currency: "USD", region: "commodities", providerSymbol: "XAU/USD" },
  { symbol: "SI=F", name: "Silver", exchange: "COMEX", assetType: "commodity", currency: "USD", region: "commodities", providerSymbol: "XAG/USD" },
  { symbol: "CL=F", name: "Crude Oil (WTI)", exchange: "NYMEX", assetType: "commodity", currency: "USD", region: "commodities" },
  { symbol: "BZ=F", name: "Brent Crude", exchange: "ICE", assetType: "commodity", currency: "USD", region: "commodities" },
  { symbol: "NG=F", name: "Natural Gas", exchange: "NYMEX", assetType: "commodity", currency: "USD", region: "commodities" },
  { symbol: "HG=F", name: "Copper", exchange: "COMEX", assetType: "commodity", currency: "USD", region: "commodities" },
  { symbol: "PL=F", name: "Platinum", exchange: "NYMEX", assetType: "commodity", currency: "USD", region: "commodities", providerSymbol: "XPT/USD" },
  { symbol: "ZW=F", name: "Wheat", exchange: "CBOT", assetType: "commodity", currency: "USD", region: "commodities" },
];

const FOREX: QuoteConfig[] = [
  { symbol: "USDINR=X", name: "USD/INR", exchange: "FX", assetType: "forex", currency: "INR", region: "forex", providerSymbol: "USD/INR" },
  { symbol: "EURUSD=X", name: "EUR/USD", exchange: "FX", assetType: "forex", currency: "USD", region: "forex", providerSymbol: "EUR/USD" },
  { symbol: "GBPUSD=X", name: "GBP/USD", exchange: "FX", assetType: "forex", currency: "USD", region: "forex", providerSymbol: "GBP/USD" },
  { symbol: "USDJPY=X", name: "USD/JPY", exchange: "FX", assetType: "forex", currency: "JPY", region: "forex", providerSymbol: "USD/JPY" },
  { symbol: "EURINR=X", name: "EUR/INR", exchange: "FX", assetType: "forex", currency: "INR", region: "forex", providerSymbol: "EUR/INR" },
  { symbol: "GBPINR=X", name: "GBP/INR", exchange: "FX", assetType: "forex", currency: "INR", region: "forex", providerSymbol: "GBP/INR" },
  { symbol: "AUDUSD=X", name: "AUD/USD", exchange: "FX", assetType: "forex", currency: "USD", region: "forex", providerSymbol: "AUD/USD" },
  { symbol: "USDCHF=X", name: "USD/CHF", exchange: "FX", assetType: "forex", currency: "CHF", region: "forex", providerSymbol: "USD/CHF" },
];

const CRYPTO: QuoteConfig[] = [
  { symbol: "BTC-USD", name: "Bitcoin", exchange: "CRYPTO", assetType: "crypto", currency: "USD", region: "crypto", providerSymbol: "BTC/USD" },
  { symbol: "ETH-USD", name: "Ethereum", exchange: "CRYPTO", assetType: "crypto", currency: "USD", region: "crypto", providerSymbol: "ETH/USD" },
  { symbol: "SOL-USD", name: "Solana", exchange: "CRYPTO", assetType: "crypto", currency: "USD", region: "crypto", providerSymbol: "SOL/USD" },
  { symbol: "ADA-USD", name: "Cardano", exchange: "CRYPTO", assetType: "crypto", currency: "USD", region: "crypto", providerSymbol: "ADA/USD" },
];

const MOVER_SYMBOLS: QuoteConfig[] = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries", exchange: "NSE", assetType: "equity", currency: "INR", region: "movers", sector: "Energy" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", exchange: "NSE", assetType: "equity", currency: "INR", region: "movers", sector: "Technology" },
  { symbol: "INFY.NS", name: "Infosys", exchange: "NSE", assetType: "equity", currency: "INR", region: "movers", sector: "Technology" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", exchange: "NSE", assetType: "equity", currency: "INR", region: "movers", sector: "Banking" },
  { symbol: "SBIN.NS", name: "State Bank of India", exchange: "NSE", assetType: "equity", currency: "INR", region: "movers", sector: "Banking" },
  { symbol: "WIPRO.NS", name: "Wipro", exchange: "NSE", assetType: "equity", currency: "INR", region: "movers", sector: "Technology" },
  { symbol: "TECHM.NS", name: "Tech Mahindra", exchange: "NSE", assetType: "equity", currency: "INR", region: "movers", sector: "Technology" },
  { symbol: "BAJFINANCE.NS", name: "Bajaj Finance", exchange: "NSE", assetType: "equity", currency: "INR", region: "movers", sector: "Financial Services" },
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", assetType: "equity", currency: "USD", region: "movers", providerSymbol: "AAPL", sector: "Technology" },
  { symbol: "NVDA", name: "NVIDIA", exchange: "NASDAQ", assetType: "equity", currency: "USD", region: "movers", providerSymbol: "NVDA", sector: "Technology" },
];

const US_PEERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"];
const INDIA_PEERS = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "SBIN.NS"];
const KNOWN_EQUITIES: QuoteConfig[] = [
  ...MOVER_SYMBOLS,
  { symbol: "MSFT", name: "Microsoft", exchange: "NASDAQ", assetType: "equity", currency: "USD", providerSymbol: "MSFT" },
  { symbol: "GOOGL", name: "Alphabet", exchange: "NASDAQ", assetType: "equity", currency: "USD", providerSymbol: "GOOGL" },
  { symbol: "AMZN", name: "Amazon", exchange: "NASDAQ", assetType: "equity", currency: "USD", providerSymbol: "AMZN" },
];

const EQUITY_NAME_MAP = new Map<string, QuoteConfig>(
  KNOWN_EQUITIES.map((config) => [config.symbol, config])
);

export const MARKET_OVERVIEW_SECTIONS = {
  india: INDIA_INDICES,
  us: US_INDICES,
  europe: EUROPE_INDICES,
  special: SPECIAL_MARKETS,
} as const;

export const COMMODITIES_FOREX_SECTIONS = {
  commodities: COMMODITIES,
  forex: FOREX,
  crypto: CRYPTO,
} as const;

export const MARKET_OVERVIEW_SYMBOLS = [
  ...INDIA_INDICES,
  ...US_INDICES,
  ...EUROPE_INDICES,
  ...SPECIAL_MARKETS,
];

export const MOVER_SYMBOL_LIST = MOVER_SYMBOLS;

export function inferExchange(symbol: string): string {
  if (symbol.endsWith(".NS")) return "NSE";
  if (symbol.endsWith(".BO")) return "BSE";
  if (symbol.startsWith("^")) return "INDEX";
  if (symbol.endsWith("-USD")) return "CRYPTO";
  if (symbol.includes("=X")) return "FX";
  if (symbol.endsWith("=F")) return "FUTURES";
  return "NASDAQ";
}

export function inferAssetType(symbol: string): QuoteConfig["assetType"] {
  if (symbol.endsWith("-USD")) return "crypto";
  if (symbol.includes("=X")) return "forex";
  if (symbol.endsWith("=F")) return "commodity";
  if (symbol.startsWith("^")) return "index";
  return "equity";
}

export function inferCurrency(symbol: string): string {
  if (symbol.endsWith(".NS") || symbol.endsWith(".BO") || symbol === "^NSEI" || symbol === "^BSESN" || symbol === "^NSEBANK" || symbol === "^CNXMIDCAP" || symbol === "^INDIAVIX") {
    return "INR";
  }

  if (symbol.includes("JPY")) return "JPY";
  if (symbol.includes("CHF")) return "CHF";
  if (symbol.includes("GBP")) return "GBP";
  if (symbol.includes("EUR")) return "EUR";
  return "USD";
}

export function createSymbolConfig(symbol: string, overrides: Partial<QuoteConfig> = {}): QuoteConfig {
  const base = EQUITY_NAME_MAP.get(symbol);
  if (base) {
    return {
      ...base,
      ...overrides,
    };
  }

  const assetType = inferAssetType(symbol);
  const exchange = inferExchange(symbol);
  return {
    symbol,
    name: symbol,
    exchange,
    assetType,
    currency: inferCurrency(symbol),
    providerSymbol: assetType === "equity" && !symbol.endsWith(".NS") && !symbol.endsWith(".BO") && !symbol.startsWith("^") ? symbol : overrides.providerSymbol,
    ...overrides,
  };
}

export function getPeerConfigs(symbol: string): QuoteConfig[] {
  const peers = symbol.endsWith(".NS") || symbol.endsWith(".BO") ? INDIA_PEERS : US_PEERS;
  return peers.map((peerSymbol) =>
    createSymbolConfig(peerSymbol, {
      name: EQUITY_NAME_MAP.get(peerSymbol)?.name ?? peerSymbol,
    })
  );
}
