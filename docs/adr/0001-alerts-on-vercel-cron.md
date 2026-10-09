# ADR 0001: Evaluate alerts with Vercel Cron, once per market close

- **Status:** Accepted, 2026-10-09
- **Issue:** [#148](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/148)

## Context

Users can set a price alert on any watchlist row (`watchlist.alert_price`), and
the UI shows it, but nothing has ever evaluated one: no part of the stack runs on
a schedule. `apscheduler` is in `ml/requirements.txt` but unused, and the ML
service's free Render/Railway tier sleeps after 15 idle minutes, so an
in-process scheduler there would not fire while users are away, which is the
only time an alert matters.

Options considered (from #148):

1. **Vercel Cron → a Next.js API route.** No new service; the route already has
   the Supabase service client and the quote providers.
2. **Supabase `pg_cron` / scheduled Edge Function.** Lives next to the data, but
   quote fetching would be a second implementation of what
   `src/lib/server/market.ts` already does.
3. **A worker on Render.** Needs a paid instance to avoid spin-down, which is
   against the project's free-tier-first stance.

## Decision

Option 1. Two cron jobs in `vercel.json`, each calling
`/api/cron/alerts?market=…` shortly after that market's close:

| Job | Schedule (UTC) | Market close |
|---|---|---|
| India | `30 10 * * 1-5` | NSE/BSE 15:30 IST = 10:00 UTC |
| US | `30 21 * * 1-5` | NYSE/NASDAQ 16:00 ET = 20:00 / 21:00 UTC (DST) |

Vercel's Hobby plan runs a cron job **at most once per day, within the hour it is
scheduled for** (measured against the Vercel docs, 2026-07). That is not a
compromise here: alerts are evaluated against the **session's high and low**, so
a level touched at any point during the day is caught by one post-close run, and
every model in `ml/` works on daily candles, so a signal cannot change more than
once per session anyway.

The route authenticates with `Authorization: Bearer $CRON_SECRET` (Vercel sends
this header when `CRON_SECRET` is set) and returns 401 otherwise.

### Alert semantics

- **One-shot.** An alert fires once when the session range touches its level,
  sets `watchlist.alert_triggered_at`, and stays quiet until the user re-arms it
  by setting a level again. This mirrors broker price alerts and is what makes
  evaluation idempotent: the "mark triggered" update only matches rows that are
  still armed, so a re-run or an overlapping run cannot notify twice.
- **Delivery is in-app** (a `notifications` table read by the header bell).
  Supabase Auth's mailer only sends auth emails, and adding a mail provider is a
  separate decision. Email or push can be added later as another consumer of the
  same table.
- **Per-user cap** of 20 notifications per run, so one user's long watchlist on
  a volatile day cannot become a flood.
- **Not written to `audit_log`.** That table records user actions; an alert
  firing is not one.

### Not in v1

**Signal alerts** ("RELIANCE turns STRONG_BUY"). The walk-forward backtest (#144,
`ml/backtest.py`) shows the rule-based signals do not beat the base rate yet.
Alerting on them would push an unvalidated claim at the user's phone. Revisit
once a model shows out-of-sample skill.

## Consequences

- Alerts are end-of-day, not intraday. A user who needs an intraday stop should
  use their broker's order types. The watchlist UI says "checked after market
  close" so the timing is not a surprise.
- Moving to Vercel Pro would allow per-minute schedules with no code change.
  Only the cron expressions would change, and intraday quotes would need a high/low
  since the last run rather than since the open.
- `CRON_SECRET` must be set in the Vercel project, or the route rejects every call.
