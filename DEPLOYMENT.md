# Roneira AI HIFI — Deployment Guide

Three deployment targets, one for each canonical surface. There is no Docker
path and no self-hosted database — the previous version of this guide described
a Docker Compose / multi-service Railway setup that has not existed since the
`src/` + `ml/` split, and has been rewritten.

| Surface | Target | What it runs |
|---|---|---|
| `src/` | **Vercel** | The Next.js app: UI and API route handlers. `vercel.json` describes it. |
| `ml/` | **Railway** or **Render** | `uvicorn app.main:app` — the FastAPI ML service. |
| `supabase/` | **Supabase** (hosted) | Postgres, Auth, RLS policies, audit triggers. |

The browser only ever talks to Vercel. The ML service is reached server-side by
the Next.js route handlers, never directly by the client.

---

## 1. Supabase

1. Create a project at https://supabase.com.
2. Apply `supabase/migrations/*.sql` **in filename order** (there is no `004`).
   Migrations 007–009 fix bugs found after `001` was already live — 007 RLS
   admin-policy recursion, 008 anon username lookup (login breaks without it),
   009 makes `audit_log` append-only via triggers, which hold even against a
   `service_role` connection.
3. From Settings → API, copy the project URL, the `anon` key, and the
   `service_role` key.

## 2. ML service (`ml/`)

Railway and Render both work; the service is a standard uvicorn app.

- **Root directory:** `ml`
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  (already in `ml/Procfile` and `ml/railway.json`)
- **Python:** pinned by `ml/runtime.txt`
- **Build:** `pip install -r requirements.txt`

No training step at deploy — the trained artifacts are committed under
`ml/artifacts/generated`, which is what keeps this deployable on a free tier.

**Required environment variable:**

| Variable | Value |
|---|---|
| `ML_SERVICE_TOKEN` | A shared secret. Generate with `openssl rand -hex 32`. |

This is not optional. The service is publicly routable so Vercel can reach it,
and CORS is a browser policy that does nothing against a non-browser client — so
the token is what actually keeps `/predict`, `/market-data`, `/stock/{ticker}`,
`/history` and `/screener` closed. Without it those endpoints return **503**
rather than serving unauthenticated traffic.

`/` and `/health` stay open, so the platform's health check works unmodified.

Optional: `ML_MODEL_DIR` (defaults to `artifacts/generated`).

## 3. Web app (`src/`) — Vercel

Import the repository; Vercel detects Next.js. Set these in
Settings → Environment Variables:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | From step 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | From step 1. Server-side only — never expose it |
| `ML_BACKEND_URL` | The deployed ML service URL from step 2 |
| `ML_SERVICE_TOKEN` | **Must be byte-identical to step 2's value** |

Note `ML_BACKEND_URL` is deliberately **not** `NEXT_PUBLIC_`-prefixed. It is read
only by server-side route handlers; the prefix would make the internal hostname
eligible for inlining into a client bundle.

Optional provider keys (each missing one degrades a single feature rather than
breaking the app): `ALPHA_VANTAGE_API_KEY`, `FINNHUB_API_KEY`, `NEWS_API_KEY`,
`TWELVE_DATA_API_KEY`, `HUGGING_FACE_API_KEY`, and
`UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN` for rate limiting shared across
serverless instances rather than per warm instance.

See `.env.example` for the full annotated list.

---

## Verifying a deployment

```bash
# ML service is up (no token needed for /health)
curl https://<ml-host>/health

# ML data endpoints are actually closed
curl -s -o /dev/null -w '%{http_code}\n' https://<ml-host>/screener
# expect 401 (token configured) or 503 (token missing) -- never 200
```

Then load the Vercel URL and open the predictions page. If predictions return a
502, check the Vercel function logs: a token mismatch surfaces there as a 401
from the upstream, and an unset token on the ML side as a 503.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `/api/predict` returns 502 | ML service unreachable, or `ML_SERVICE_TOKEN` differs between the two platforms. Check the Vercel function log for the upstream status. |
| ML endpoints return 503 | `ML_SERVICE_TOKEN` is unset on the ML service. It fails closed by design. |
| ML endpoints return 401 | The two `ML_SERVICE_TOKEN` values do not match. |
| Login fails for username (not email) | Migration `008` not applied. |
| Admin dashboard errors with a recursion message | Migration `007` not applied. |
| Quotes all come from yfinance and are slow | `TWELVE_DATA_API_KEY` unset — expected degradation, not a fault. |
