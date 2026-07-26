# Roneira AI HIFI Launch Task

## Objective
- Ship the root `src/` Next.js application and the `ml/` FastAPI service as the only active production surfaces.
- Replace dashboard mocks with live data, persistence, audit logging, and artifact-backed ML inference.

## Canonical Paths
- Frontend / fullstack: `src/`
- ML backend: `ml/`
- Database migrations: `supabase/`
- Legacy reference only: `frontend/`, `backend/`, `ml-service/`, `realtime/`

`realtime/` (the Socket.IO tick service) is not called out elsewhere as
legacy, but audit confirms it's orphaned relative to the canonical stack: its
CORS default targets `localhost:5173` (the legacy Vite frontend's port, not
`src/`'s 3000), nothing under `src/` imports `socket.io-client` or calls it,
and it isn't wired into `ci.yml`. Treat it as reference-only alongside the
other three legacy trees unless/until something in `src/` actually consumes
it. If real-time price ticks become a requirement, evaluate whether this
service still fits the canonical (Vercel + Supabase + Railway/Render)
deployment model before reviving it as-is.

## Current Priorities
1. Align deployment and environment config with the root Next.js + `ml/` architecture.
2. Wire normalized market, search, news, and prediction APIs behind Next.js route handlers.
3. Replace page-level mocks with React Query hooks and Supabase-backed data flows.
4. Fix ML test regressions and switch LSTM/GAN to artifact-backed startup loading.
5. Add launch verification: `npm run type-check`, `npm run test:web`, `npm run build`, `python -m pytest ml/tests -q`.

## Guardrails
- Treat `audit_log` as append-only.
- Do not store volatile market prices in Supabase.
- Keep FastAPI private behind Next.js API routes.
- Use Twelve Data first for quote/history where supported, with yfinance fallback through `ml/`.
- Keep launch auth on Supabase email/password only.
