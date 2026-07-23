# Roneira AI HIFI — Backend

Node.js/TypeScript API gateway sitting between the frontend and the ML service.

## Canonical entrypoint

`src/server.ts` — a class-based Express app (`BackendServer`). This is the
**only** entrypoint: it's what `npm run dev`, `npm run build && npm start`,
and the Docker image all run. There is no other server file in this package.

```bash
npm run dev     # ts-node-dev, hot reload, reads src/server.ts directly
npm run build   # tsc -> dist/
npm start       # node dist/server.js (compiled from src/server.ts)
```

## Environment variables

Copy `.env.example` to `.env` and fill in values. See `.env.example` for the
full list and defaults; the notable ones:

| Variable | Required | Notes |
|---|---|---|
| `ML_SERVICE_URL` | yes (has default) | Base URL of the ML service. Defaults to `http://localhost:8000`, matching the ml-service's `uvicorn` default port. In docker-compose this is `http://ml-service:8000`. |
| `DATABASE_URL` | no | Postgres/TimescaleDB connection string. When unset, portfolio storage falls back to an in-memory store (data is lost on restart — a warning is logged on every write). |
| `REDIS_URL` | no | When unset, caching falls back to an in-process memory cache. |
| `SUPABASE_JWT_SECRET` | yes for auth | The backend verifies Supabase-issued access tokens on protected routes (e.g. `/api/portfolio`); it does not issue its own. Set to your Supabase project's JWT secret. Login/signup happen on the frontend via Supabase Auth. |
| `ALPHA_VANTAGE_API_KEY` | no | Defaults to Alpha Vantage's shared `demo` key (heavily rate-limited; get a free key at alphavantage.co). |

## Running against the ML service without Docker

The backend expects the ML service reachable at `ML_SERVICE_URL`. For a
self-contained local run without `docker-compose`:

```bash
# Terminal 1
cd ml-service && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2
cd backend
cp .env.example .env   # ML_SERVICE_URL already points at localhost:8000
npm ci
npm run dev
```

Tests do not require a live ML service — `axios` calls are mocked in
`tests/*.test.ts`, so `npm test` is self-contained.

## Tests

```bash
npm test              # jest, matches tests/**/*.test.ts only
npm run test:watch
npm run test:integration
```

Only `.ts` files under `tests/` are picked up (see `jest.config.js`
`testMatch`). Do not add `.js` test files — they will silently never run.
