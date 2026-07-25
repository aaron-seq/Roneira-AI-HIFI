/**
 * Prediction timeframe helpers.
 *
 * Extracted from the /api/predict route handler so they can be unit tested
 * directly: Next.js validates the exports of a `route.ts` file, so shared
 * logic belongs in a module rather than as extra exports from the route.
 */

export const TIMEFRAME_DAYS: Record<string, number> = {
  tomorrow: 1,
  "1week": 7,
  "1month": 30,
  "3month": 90,
  "6month": 180,
  "1year": 365,
  "1year_plus": 400,
};

/** Days to project for a timeframe key, defaulting to one month if unknown. */
export function getTimeframeDays(timeframe: string): number {
  return TIMEFRAME_DAYS[timeframe] ?? 30;
}

/**
 * Resolve a timeframe key to an absolute ISO target date.
 *
 * @param timeframe - one of the TIMEFRAME_DAYS keys; unknown values fall back
 *   to 30 days so a malformed request still produces a usable target rather
 *   than an invalid date.
 * @param from - base date, defaulting to now. Injectable for deterministic tests.
 */
export function getTargetDate(timeframe: string, from: Date = new Date()): string {
  const target = new Date(from.getTime());
  target.setUTCDate(target.getUTCDate() + getTimeframeDays(timeframe));
  return target.toISOString();
}
