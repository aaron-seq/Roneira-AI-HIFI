/**
 * Roneira AI HIFI - API Response Schemas
 *
 * Zod schemas for validating all API responses on the frontend.
 * Provides type safety and runtime validation to catch malformed data.
 *
 * @module schemas/apiSchemas
 */

import { z } from 'zod';

// =====================================================
// COMMON SCHEMAS
// =====================================================

/**
 * API response wrapper schema
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        type: z.string(),
        message: z.string(),
        details: z.array(z.unknown()).optional(),
      })
      .optional(),
    timestamp: z.string().optional(),
  });

// =====================================================
// STOCK DATA SCHEMAS
// =====================================================

/**
 * Stock quote response schema
 */
export const StockQuoteSchema = z.object({
  symbol: z.string(),
  name: z.string().optional(),
  price: z.number(),
  change: z.number(),
  changePercent: z.number(),
  volume: z.number().optional(),
  marketCap: z.number().optional(),
  high: z.number().optional(),
  low: z.number().optional(),
  open: z.number().optional(),
  previousClose: z.number().optional(),
  timestamp: z.string().optional(),
});

export type StockQuote = z.infer<typeof StockQuoteSchema>;

/**
 * Historical price data point schema
 */
export const PriceDataPointSchema = z.object({
  date: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  adjustedClose: z.number().optional(),
});

export type PriceDataPoint = z.infer<typeof PriceDataPointSchema>;

// =====================================================
// PREDICTION SCHEMAS
// =====================================================

/**
 * Stock prediction response schema
 */
export const StockPredictionSchema = z.object({
  ticker: z.string(),
  current_price: z.number(),
  predicted_price: z.number(),
  price_change: z.number(),
  price_change_percent: z.number(),
  confidence: z.number().min(0).max(1),
  prediction_date: z.string().optional(),
  model_type: z.string().optional(),
  model_version: z.string().optional(),
  technical_indicators: z
    .object({
      sma_20: z.number().optional(),
      sma_50: z.number().optional(),
      ema_12: z.number().optional(),
      ema_26: z.number().optional(),
      rsi: z.number().optional(),
      macd: z.number().optional(),
      volume_trend: z.string().optional(),
    })
    .optional(),
  pdm_analysis: z
    .object({
      signal: z.enum(['BUY', 'SELL', 'HOLD']).optional(),
      strength: z.number().optional(),
      momentum: z.number().optional(),
      liquidity: z.number().optional(),
    })
    .optional(),
  sentiment: z
    .object({
      score: z.number().optional(),
      label: z.string().optional(),
      confidence: z.number().optional(),
    })
    .optional(),
});

export type StockPrediction = z.infer<typeof StockPredictionSchema>;

/**
 * Batch prediction response schema
 */
export const BatchPredictionSchema = z.object({
  predictions: z.array(StockPredictionSchema),
  batch_id: z.string().optional(),
  requested_at: z.string().optional(),
  completed_at: z.string().optional(),
});

export type BatchPrediction = z.infer<typeof BatchPredictionSchema>;

// =====================================================
// PDM STRATEGY SCHEMAS
// =====================================================

/**
 * PDM opportunity schema
 */
export const PDMOpportunitySchema = z.object({
  ticker: z.string(),
  signal: z.enum(['BUY', 'SELL', 'HOLD']),
  strength: z.number().min(0).max(1),
  price: z.number(),
  momentum: z.number().optional(),
  volume_score: z.number().optional(),
  recommended_action: z.string().optional(),
  entry_price: z.number().optional(),
  stop_loss: z.number().optional(),
  take_profit: z.number().optional(),
});

export type PDMOpportunity = z.infer<typeof PDMOpportunitySchema>;

/**
 * PDM scan response schema
 */
export const PDMScanResponseSchema = z.object({
  opportunities: z.array(PDMOpportunitySchema),
  scanned_tickers: z.number(),
  scan_time: z.string().optional(),
});

export type PDMScanResponse = z.infer<typeof PDMScanResponseSchema>;

/**
 * PDM backtest result schema
 */
export const PDMBacktestResultSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  total_trades: z.number(),
  winning_trades: z.number(),
  losing_trades: z.number(),
  win_rate: z.number(),
  total_return: z.number(),
  max_drawdown: z.number().optional(),
  sharpe_ratio: z.number().optional(),
  trades: z
    .array(
      z.object({
        ticker: z.string(),
        entry_date: z.string(),
        exit_date: z.string(),
        entry_price: z.number(),
        exit_price: z.number(),
        profit_loss: z.number(),
      })
    )
    .optional(),
});

export type PDMBacktestResult = z.infer<typeof PDMBacktestResultSchema>;

// =====================================================
// PORTFOLIO SCHEMAS
// =====================================================

/**
 * Portfolio holding schema
 */
export const PortfolioHoldingSchema = z.object({
  id: z.string().optional(),
  ticker: z.string(),
  shares: z.number().positive(),
  avgCost: z.number().nonnegative(),
  currentPrice: z.number().nonnegative().optional(),
  marketValue: z.number().optional(),
  gainLoss: z.number().optional(),
  gainLossPercent: z.number().optional(),
  purchaseDate: z.string().optional(),
  notes: z.string().optional(),
});

export type PortfolioHolding = z.infer<typeof PortfolioHoldingSchema>;

/**
 * Portfolio summary schema
 */
export const PortfolioSummarySchema = z.object({
  totalValue: z.number(),
  totalCost: z.number(),
  totalGainLoss: z.number(),
  totalGainLossPercent: z.number(),
  holdings: z.array(PortfolioHoldingSchema),
  lastUpdated: z.string().optional(),
});

export type PortfolioSummary = z.infer<typeof PortfolioSummarySchema>;

// =====================================================
// NEWS & SENTIMENT SCHEMAS
// =====================================================

/**
 * News article schema
 */
export const NewsArticleSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  summary: z.string().optional(),
  source: z.string().optional(),
  url: z.string().url().optional(),
  publishedAt: z.string().optional(),
  sentiment: z
    .object({
      score: z.number(),
      label: z.enum(['positive', 'negative', 'neutral']),
    })
    .optional(),
  relatedTickers: z.array(z.string()).optional(),
});

export type NewsArticle = z.infer<typeof NewsArticleSchema>;

/**
 * News feed response schema
 */
export const NewsFeedSchema = z.object({
  articles: z.array(NewsArticleSchema),
  totalCount: z.number().optional(),
  lastUpdated: z.string().optional(),
});

export type NewsFeed = z.infer<typeof NewsFeedSchema>;

// =====================================================
// HEALTH & STATUS SCHEMAS
// =====================================================

/**
 * Health check response schema
 */
export const HealthCheckSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  service: z.string().optional(),
  version: z.string().optional(),
  uptime: z.number().optional(),
  timestamp: z.string(),
  dependencies: z
    .record(
      z.object({
        status: z.enum(['up', 'down', 'unknown']),
        latency: z.number().optional(),
      })
    )
    .optional(),
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;

// =====================================================
// VALIDATION UTILITIES
// =====================================================

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Safely parse data with a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with parsed data or errors
 */
export function safeValidate<T>(
  schema: z.ZodType<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map(
    (err) => `${err.path.join('.')}: ${err.message}`
  );

  return { success: false, errors };
}

/**
 * Validate and throw on error
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @throws {Error} If validation fails
 */
export function validateOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('; ');
    throw new Error(`Validation failed: ${errorMessages}`);
  }

  return result.data;
}
