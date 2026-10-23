# Roneira AI HIFI — Deployment Guide

Three deployment targets, one for each canonical surface. Development can use
Docker through the Supabase CLI; production uses the targets below rather than
the deleted legacy Docker Compose services.

| Surface | Target | What it runs |
|---|---|---|
| `src/` | **Vercel** | The Next.js app: UI and API route handlers. `vercel.json` describes it. |
| `ml/` | **Railway** or **Render** | `uvicorn app.main:app` — the FastAPI ML service. |
| `supabase/` | **Supabase** (hosted) | Postgres, Auth, RLS policies, audit triggers. |

Browser market-data and inference requests go through Vercel's Next.js routes.
Browser Supabase clients also call Supabase directly for authentication and
private records under RLS. The ML service is reached server-side by the Next.js
route handlers, never directly by the client.

---

## 1. Supabase

1. Create a project at https://supabase.com.
2. Apply `supabase/migrations/*.sql` **in filename order**, 001 through 015
   (`004` is absent). For CLI deployment, link the intended project with
   `npx supabase link --project-ref <project-ref>` before `npx supabase db push`.
   Migrations 007–009 fix bugs found after `001` was already live — 007 RLS
   admin-policy recursion, 008 anon username lookup (login breaks without it),
   009 makes `audit_log` append-only via triggers, which hold even against a
   `service_role` connection. Migration 010 locks self-edits of the user role;
   011 adds price-alert state; 012 delivers an armed alert and notification
   atomically, with retry and privilege checks. Migration 013 adds private portfolio valuation snapshots and a service-only ordered-save function; apply it before deploying portfolio history routes. Migration 014 removes direct client audit INSERT access. Deploy the trusted audit-writing routes before or with 014; retain those routes and the restrictive permissions during rollback. Migration 015 repairs Auth hard-delete while retaining immutable audit events; run it as the trusted migration owner. It does not authorize production account deletion or establish erasure. Review [ADR 0002](docs/adr/0002-audit-retention-on-account-deletion.md) for retained data and rollback limits. Never apply `supabase/seed.sql`
   or the disposable `supabase/tests/bootstrap.sql` to a hosted project.
3. From Settings → API, copy the project URL, the `anon` key, and the
   `service_role` key.

## 2. ML service (`ml/`)

Railway and Render both work; the service is a standard uvicorn app.

- **Root directory:** `ml`
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  (already in `ml/Procfile` and `ml/railway.json`)
- **Python:** pinned by `ml/runtime.txt`
- **Build:** `pip install -r requirements.txt`

### Railway dashboard setup

Open the existing Railway project and select the service connected to this
repository. Set these dashboard values before deploying `main`:

| Setting | Value |
|---|---|
| Repository / branch | `aaron-seq/Roneira-AI-HIFI` / `main` |
| Root Directory | `/ml` |
| Builder | Railpack |
| Python | `3.11.9`, read from `ml/runtime.txt` |
| Build/install override | Leave automatic; Railpack installs `requirements.txt` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check | `/health` |

The retired `ml-service/` tree is not the current service. Railpack supports
`runtime.txt`; an existing `RAILPACK_PYTHON_VERSION` or mise-compatible version
file takes precedence, so check for an old override if the build selects another
Python version.

**Legacy config-file compatibility:** Railway has deprecated `railway.json` /
`railway.toml`. New services cannot opt into that mechanism; legacy services
that already use it retain support only until **2026-12-01**, according to the
current [migration guide](https://docs.railway.com/infrastructure-as-code#migrating-from-config-as-code).
For an eligible existing service, its Railway Config File path is
`/ml/railway.json`, independently of Root Directory. That compatibility recipe
now selects Railpack and the same start/health settings as the table. A config
file overrides dashboard values while it is active. Set the dashboard values
explicitly and verify the deployment's effective settings; do not rely solely
on a file that will stop being read. Leave the config-file setting unset for a
dashboard-managed service.

For durable managed configuration, import the existing target into Railway's
current Infrastructure as Code workflow and review its plan before applying it.
Preserve service/domain/environment identities and secret bindings; do not
replace the project or rotate credentials as part of an unreviewed import.
The migration is tracked in [#209](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/209).
This connection-repair guide does not provision an IaC stack or accept a paid
resource plan.

Add `ML_SERVICE_TOKEN` under the service's Variables using a newly generated
secret. Generate it privately with `openssl rand -hex 32`; copy the same value
to Vercel's server-side `ML_SERVICE_TOKEN` setting. Do not put it in Git, a
public-prefixed variable or a chat message.

Deploy the service, then use **Settings → Networking → Generate Domain** to
obtain its public HTTPS base URL. Check that `<base-url>/health` returns HTTP 200.
This proves process health, not successful provider access or a matching caller
token. Complete the Vercel steps below before declaring market data restored.
Check the project's plan and usage before selecting any paid resource.

References: Railway's [monorepo paths](https://docs.railway.com/deployments/monorepo),
[builder settings](https://docs.railway.com/config-as-code/reference#specify-the-builder)
and Railpack's [Python support](https://railpack.com/languages/python/).

No training step at deploy — the trained artifacts are committed under
`ml/artifacts/generated`, which is what keeps this deployable on a free tier.
Ship model files and their metadata together. The current bundles are trained for
30 observed sessions and use `origin-inclusive-v2`; older bundles fail compatibility
checks and produce a disclosed no-change fallback. `/health` reports readiness only
for a compatible loaded artifact. Deploy the API contract, UI and bundled artifacts
together; rollback by reverting the complete change. TensorFlow training is disabled.

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

Use Node >=22.12 as required by `package.json`. Local checks use `npm ci` and
the committed lockfile; verify the selected Vercel runtime before deploying.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | From step 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | From step 1. Server-side only — never expose it |
| `ML_BACKEND_URL` | The deployed ML service URL from step 2 |
| `ML_SERVICE_TOKEN` | **Must be byte-identical to step 2's value** |
| `CRON_SECRET` | Required for the scheduled in-app price alerts; generate a separate secret |

Note `ML_BACKEND_URL` is deliberately **not** `NEXT_PUBLIC_`-prefixed. It is read
only by server-side route handlers; the prefix would make the internal hostname
eligible for inlining into a client bundle.

### Connect the Railway service to production

In the Vercel project's **Settings → Environment Variables**, select the
**Production** environment and set:

- `ML_BACKEND_URL`: the generated Railway HTTPS base URL, without `/health` or
  another endpoint path. Do not use `localhost`, `127.0.0.1` or an old service
  hostname that has not been verified. `NEXT_PUBLIC_ML_BACKEND_URL` is not read
  by the server routes.
- `ML_SERVICE_TOKEN`: exactly the same secret as Railway's value.

Redeploy the latest production deployment after saving the settings. Preview
environments require their own explicit configuration if they also need the
service.

Verify these web routes return actual data, using the production site URL:

```text
/api/market-data?symbols=%5ENSEI
/api/market-data/history?symbol=%5ENSEI&interval=1day&range=1month
```

The first response must contain a NIFTY 50 quote; the second must contain a
nonempty `candles` array. HTTP 200 alone does not prove either: quote-provider
failures can currently produce an empty successful response. An HTTP 200 from
the backend's `/health` endpoint also does not exercise these authenticated
provider calls. Do not post the shared token while collecting diagnostics.

Optional provider keys (each missing one degrades a single feature rather than
breaking the app): `ALPHA_VANTAGE_API_KEY`, `FINNHUB_API_KEY`, `NEWS_API_KEY`,
`TWELVE_DATA_API_KEY`, and
`UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN` for rate limiting shared across
serverless instances rather than per warm instance.

`HUGGING_FACE_API_KEY` remains in the template but the current news route uses
local keyword sentiment; no active application code consumes that key.

The two schedules in `vercel.json` call `/api/cron/alerts` after market close.
They require migration 012 and `CRON_SECRET`. Check the hosting plan's cron
limits and execution logs; local `npm run dev` does not run the schedule. See
[ADR 0001](docs/adr/0001-alerts-on-vercel-cron.md) for session/re-arm semantics.

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
| Chart history logs `ECONNREFUSED 127.0.0.1:8000` | The effective ML target is loopback. Set the server-side `ML_BACKEND_URL` to the active hosted service and redeploy; the public-prefixed variable is ignored. |
| `/api/predict` returns 502 | ML service unreachable, or `ML_SERVICE_TOKEN` differs between the two platforms. Check the Vercel function log for the upstream status. |
| ML endpoints return 503 | `ML_SERVICE_TOKEN` is unset on the ML service. It fails closed by design. |
| ML endpoints return 401 | The two `ML_SERVICE_TOKEN` values do not match. |
| Login fails for username (not email) | Migration `008` not applied. |
| Admin dashboard errors with a recursion message | Migration `007` not applied. |
| Quotes all come from yfinance and are slow | `TWELVE_DATA_API_KEY` unset — expected degradation, not a fault. |
