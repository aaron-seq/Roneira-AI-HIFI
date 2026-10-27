type FailureReason = "missing_backend_url" | "invalid_backend_url" | "missing_service_token"
  | "upstream_http" | "upstream_transport" | "upstream_payload";

export class MLServiceError extends Error {
  readonly status: 502 | 503;
  readonly code: "ML_SERVICE_CONFIGURATION_ERROR" | "ML_SERVICE_UNAVAILABLE";

  constructor(readonly reason: FailureReason, readonly upstreamStatus?: number) {
    const configuration = reason === "missing_backend_url" || reason === "invalid_backend_url" || reason === "missing_service_token";
    super(configuration ? "Market service is not configured." : "Market service is temporarily unavailable.");
    this.name = "MLServiceError";
    this.status = configuration ? 503 : 502;
    this.code = configuration ? "ML_SERVICE_CONFIGURATION_ERROR" : "ML_SERVICE_UNAVAILABLE";
  }
}

export function reportMLServiceError(error: MLServiceError) {
  // Never retain the original fetch/parse exception or upstream response body:
  // both can contain credentials, configured URLs or provider payload excerpts.
  console.error("ML service request failed", {
    code: error.code, reason: error.reason, upstreamStatus: error.upstreamStatus,
  });
}

export function mlServiceErrorResponse(error: unknown, headers?: HeadersInit): Response | null {
  if (!(error instanceof MLServiceError)) return null;
  reportMLServiceError(error);
  const responseHeaders = new Headers(headers);
  if (!responseHeaders.has("Cache-Control")) responseHeaders.set("Cache-Control", "no-store");
  return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: responseHeaders });
}

function backendOrigin(): string {
  const production = process.env.NODE_ENV === "production";
  const configured = process.env.ML_BACKEND_URL?.trim();
  if (production && !configured) throw new MLServiceError("missing_backend_url");
  try {
    const url = new URL(configured || "http://localhost:8000");
    const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
    const loopback = host === "localhost" || host.endsWith(".localhost") || /^127\./.test(host)
      || host === "::1" || host === "::" || host === "0.0.0.0" || /^::ffff:7f[0-9a-f]{2}:/.test(host);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
      || url.pathname !== "/" || url.search || url.hash
      || (production && (url.protocol !== "https:" || loopback))) {
      throw new Error("Invalid origin");
    }
    return url.origin;
  } catch {
    throw new MLServiceError("invalid_backend_url");
  }
}

type RequestOptions = { method?: "GET" | "POST"; body?: string; timeoutMs?: number };

export async function fetchMLJson<T = Record<string, unknown>>(
  path: string, { method = "GET", body, timeoutMs = 10_000 }: RequestOptions = {},
): Promise<T> {
  // Resolve lazily: a healthy primary provider or an unauthorized request must
  // not be gated by configuration for an ML call it will never make.
  const origin = backendOrigin();
  let url: URL;
  try {
    url = new URL(path, origin);
    if (url.origin !== origin) throw new Error("Invalid path");
  } catch {
    throw new MLServiceError("invalid_backend_url");
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (url.pathname !== "/health") {
    const token = process.env.ML_SERVICE_TOKEN;
    if (!token?.trim()) throw new MLServiceError("missing_service_token");
    headers["X-ML-Service-Token"] = token;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method, body, headers, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new MLServiceError("upstream_transport");
  }
  if (!response.ok) throw new MLServiceError("upstream_http", response.status);
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid object");
    return payload as T;
  } catch {
    throw new MLServiceError("upstream_payload");
  }
}
