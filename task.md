# Roneira AI HIFI Launch Task

## Objective
- Ship the root `src/` Next.js application and the `ml/` FastAPI service as the only active production surfaces.
- Replace dashboard mocks with live data, persistence, audit logging, and artifact-backed ML inference.

## Canonical Paths
- Frontend / fullstack: `src/`
- ML backend: `ml/`
- Database migrations: `supabase/`

The legacy trees (`frontend/`, `backend/`, `ml-service/`, `realtime/`,
`infrastructure/`) and `docker-compose.yml` were **deleted** — see the commit
that removed them for the full contents, which git history preserves. Nothing
under `src/` or `ml/` referenced them, they were never built, tested, or
deployed, and keeping them on disk meant every grep, Trivy scan, and code
search hit four dead implementations of the same concepts.

If real-time price ticks become a requirement, the old `realtime/` Socket.IO
service is recoverable from history, but evaluate whether it fits the
canonical (Vercel + Supabase + Railway/Render) model before reviving it — it
was built against the Vite frontend's port and never wired into CI.

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
