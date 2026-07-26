/**
 * Request validation for the API route handlers.
 *
 * Extracted from `route.ts` files for the same reason as `market/timeframe.ts`:
 * Next.js validates the exports of a route module, so shared logic lives here.
 *
 * The enums below mirror the CHECK constraints in
 * `supabase/migrations/001_initial_schema.sql`. Without them a bad value reached
 * Postgres and came back as a 500; validating here turns that into a 400, and
 * keeps unbounded JSON out of the append-only audit_log.
 */
import { z } from "zod";
import { TIMEFRAME_DAYS } from "@/lib/market/timeframe";

/** audit_log.action_type CHECK constraint. */
export const AUDIT_ACTION_TYPES = [
  "ADD_STOCK",
  "EDIT_HOLDING",
  "DELETE_HOLDING",
  "RUN_PREDICTION",
  "LOGIN",
  "LOGOUT",
  "ADD_WATCHLIST",
  "REMOVE_WATCHLIST",
  "PRICE_ALERT",
  "SIGNUP",
  "SETTINGS_CHANGE",
] as const;

/** audit_log.entity_type CHECK constraint. */
export const AUDIT_ENTITY_TYPES = [
  "portfolio",
  "watchlist",
  "prediction",
  "auth",
  "settings",
] as const;

/** predictions_cache.model_used CHECK constraint. */
export const PREDICTION_MODELS = [
  "LSTM",
  "RANDOM_FOREST",
  "GAN",
  "ENSEMBLE",
  "FUNDAMENTAL",
  "TECHNICAL",
  "PVD_MOMENTUM",
] as const;

/**
 * Ticker/symbol shape. Deliberately permissive about punctuation because real
 * symbols include suffixes and prefixes: RELIANCE.NS, ^NSEI, GC=F, BTC-USD,
 * EURUSD=X, DX-Y.NYB. The cap is what matters -- it stops absurd input being
 * forwarded into provider URLs.
 */
const tickerSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z0-9.^=:-]+$/, "invalid ticker symbol");

/** Audit payloads are attacker-influenced JSON landing in an append-only table. */
const MAX_AUDIT_JSON_BYTES = 16_384;

const boundedJson = z
  .record(z.unknown())
  .nullish()
  .refine(
    (value) =>
      value == null || JSON.stringify(value).length <= MAX_AUDIT_JSON_BYTES,
    { message: `payload exceeds ${MAX_AUDIT_JSON_BYTES} bytes` }
  );

export const auditEventSchema = z.object({
  action_type: z.enum(AUDIT_ACTION_TYPES),
  entity_type: z.enum(AUDIT_ENTITY_TYPES),
  // Column is UUID; a non-UUID string used to surface as a Postgres 500.
  entity_id: z.string().uuid().nullish(),
  old_values: boundedJson,
  new_values: boundedJson,
});

export const predictRequestSchema = z.object({
  ticker: tickerSchema,
  timeframe: z.enum(
    Object.keys(TIMEFRAME_DAYS) as [string, ...string[]]
  ),
  model_type: z.enum(PREDICTION_MODELS).optional(),
});

export const historyQuerySchema = z.object({
  symbol: tickerSchema,
  interval: z
    .enum(["1min", "5min", "15min", "1hour", "1day", "1week"])
    .default("1day"),
  range: z
    .enum(["1month", "3month", "6month", "1year", "2year"])
    .default("6month"),
});

/** Flattens a ZodError into a single human-readable line for the 400 body. */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}
