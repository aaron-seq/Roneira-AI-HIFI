/**
 * Fixed-window rate limiting for the API route handlers.
 *
 * Why this exists: the free provider tiers are tiny (Alpha Vantage allows 25
 * requests/day, NewsAPI 100/day), so an unthrottled route exhausts the day's
 * quota for every user. `/api/auth/username` additionally needs throttling
 * because it is the credential-checking endpoint.
 *
 * Backend selection:
 *  - Upstash REST when UPSTASH_REDIS_URL/TOKEN are set (shared across instances).
 *  - Otherwise an in-process window, using the same globalThis pinning trick as
 *    `cache.ts` so dev-server hot reloads don't reset counters.
 *
 * The in-process fallback is per-instance, so on serverless it limits per
 * warm instance rather than globally -- weaker, but real. Redis is what makes
 * the limit global; treat the fallback as a floor, not the goal.
 */
const UPSTASH_URL = process.env.UPSTASH_REDIS_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_TOKEN || "";

declare global {
  // eslint-disable-next-line no-var
  var __roneiraRateLimit: Map<string, { count: number; expiresAt: number }> | undefined;
}

const localStore =
  globalThis.__roneiraRateLimit ??
  new Map<string, { count: number; expiresAt: number }>();

if (!globalThis.__roneiraRateLimit) {
  globalThis.__roneiraRateLimit = localStore;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** True when the limit was enforced in-process rather than in Redis. */
  local: boolean;
}

/** Best-effort caller identity. Proxies put the real client first in XFF. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function bumpLocal(key: string, windowSeconds: number, limit: number): RateLimitResult {
  const now = Date.now();
  const existing = localStore.get(key);

  if (!existing || existing.expiresAt <= now) {
    localStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { ok: true, remaining: limit - 1, local: true };
  }

  existing.count += 1;
  return {
    ok: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    local: true,
  };
}

/**
 * Count one hit against `bucket` for this caller.
 *
 * Fails open on Redis errors: losing quota protection is preferable to taking
 * the route down, and the in-process counter still applies as a backstop.
 */
export async function rateLimit(
  bucket: string,
  request: Request,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `rl:${bucket}:${clientIp(request)}:${window}`;

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return bumpLocal(key, windowSeconds, limit);
  }

  try {
    const response = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSeconds],
      ]),
      cache: "no-store",
      // A limiter that can hang is worse than no limiter.
      signal: AbortSignal.timeout(2_000),
    });

    if (!response.ok) {
      return bumpLocal(key, windowSeconds, limit);
    }

    const payload = (await response.json()) as Array<{ result?: unknown }>;
    const count = Number(payload?.[0]?.result);

    if (!Number.isFinite(count)) {
      return bumpLocal(key, windowSeconds, limit);
    }

    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      local: false,
    };
  } catch {
    return bumpLocal(key, windowSeconds, limit);
  }
}

/** Standard 429 body/headers for a rejected request. */
export function tooManyRequests(retryAfterSeconds: number) {
  return Response.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}
