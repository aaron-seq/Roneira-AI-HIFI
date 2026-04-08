# Roneira AI HIFI Repo Walkthrough

## Runtime Layout
- `src/app`: Next.js App Router pages and route handlers.
- `src/components`: shared dashboard, prediction, and UI building blocks.
- `src/lib`: Supabase clients, Zustand store, shared utils, and launch data hooks.
- `ml/app`: FastAPI entrypoint plus model implementations.
- `ml/tests`: ML contract and regression tests.
- `supabase/migrations`: SQL schema and RLS policies.

## Key Flows
- Auth uses Supabase SSR middleware in `src/middleware.ts` and `src/lib/supabase/*`.
- Client pages should fetch through Next.js route handlers, not directly from third-party providers.
- Market and prediction data should flow:
  browser -> Next route handler -> provider / FastAPI -> normalized response.
- Portfolio, watchlist, audit log, and admin views should flow through Supabase with RLS-aware clients.

## Launch Expectations
- Dashboard pages must render loading, error, empty, and live-data states without mock constants.
- ML startup should preload any available artifacts from `ml/artifacts/generated/`.
- `vercel.json` should describe the root Next.js deployment only.
- Railway config should live under `ml/` and boot `app.main:app`.

## Verification Commands
- `npm run type-check`
- `npm run test:web`
- `npm run build`
- `python -m pytest ml/tests -q`
- `npm run ml:dev`
