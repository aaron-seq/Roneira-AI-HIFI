export type AssetType =
  | "equity"
  | "index"
  | "commodity"
  | "forex"
  | "crypto"
  | "volatility"
  | "yield";

export interface QuoteConfig {
  symbol: string;
  name: string;
  exchange: string;
  assetType: AssetType;
  currency: string;
  providerSymbol?: string;
  fallbackSymbol?: string;
  region?: string;
  sector?: string;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  exchange: string;
  assetType: AssetType;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  high?: number | null;
  low?: number | null;
  open?: number | null;
  previousClose?: number | null;
  volume?: number | null;
  provider: "twelve-data" | "yfinance";
  timestamp: string;
}

export interface CandlePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  currency?: string;
  provider: "finnhub" | "alpha-vantage";
}

export interface PredictionResult {
  ticker: string;
  company_name: string;
  exchange: string;
  sector?: string | null;
  pe_ratio?: number | null;
  market_cap?: number | null;
  current_price: number;
  predicted_price: number;
  price_change: number;
  price_change_percent: number;
  confidence: number;
  confidence_breakdown: Record<string, number>;
  short_term_signal: { signal: string; score: number };
  long_term_signal: { signal: string; score: number };
  indicators: Array<{ name: string; value: number; signal: string }>;
  price_target_low: number;
  price_target_high: number;
  model_used: string;
  timeframe: string;
  computation_time_ms: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  category: "global" | "india" | "stock";
  sentiment: "positive" | "negative" | "neutral";
  relatedTickers: string[];
  imageUrl?: string | null;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  username?: string | null;
}

export interface AdminOverview {
  userCount: number;
  adminCount: number;
  predictionCount: number;
  recentUsers: Array<{
    id: string;
    username: string;
    email: string | null;
    role: "admin" | "user";
    created_at: string;
  }>;
  recentAudit: AuditLogRow[];
  mlHealth: {
    status: string;
    uptime?: number;
    models_loaded?: Record<string, boolean>;
  } | null;
}
