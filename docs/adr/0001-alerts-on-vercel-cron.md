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
compromise here: alerts armed before the open can be evaluated against the
**session's high and low** in one post-close run. Intraday re-arms use the more
conservative rule below. Models consume daily candles, whose unfinished values
can still change during the session; this scheduling decision defines an
end-of-day product rather than guaranteeing fixed intraday predictions.

The route authenticates with `Authorization: Bearer $CRON_SECRET` (Vercel sends
this header when `CRON_SECRET` is set) and returns 401 otherwise.

### Alert semantics

- **One-shot.** An alert fires once when the session range touches its level,
  sets `watchlist.alert_triggered_at`, and stays quiet until the user re-arms it
  by setting a level again. Migration 012 claims the matching armed revision
  and inserts its notification in one `deliver_price_alert` database transaction.
  An insert failure rolls back the claim and the route returns HTTP 503, so a
  retry can deliver it. Repeated or overlapping runs cannot notify twice. The
  service-role-only RPC re-checks the level, revision, session date and user
  preferences; `anon` and `authenticated` cannot call it.
- **Current-session data only.** A provider's exchange-local session date or
  actual quote timestamp must match the market's current date. Receipt time is
  not evidence of freshness. Weekend, holiday, stale and undated quotes leave
  the alert armed. An unavailable daily range can only establish an exact
  last-price touch; the previous close-to-last-price interval cannot establish
  trades at skipped prices during an overnight gap.
- **No pre-arm touches.** Server-owned `alert_armed_at` and `alert_revision`
  advance when a level is set or re-armed. Full-session high/low is used only
  when the alert was armed before the session's regular open (09:15 IST or
  09:30 ET). An alert armed during or after the session can fire only for an
  exact last-price touch supported by an actual post-arm quote timestamp.
  Daily bars have no actual as-of timestamp and therefore wait for the next
  session. This conservative rule avoids presenting an earlier high or low as
  a touch that happened after the user set the alert; reliable intraday candles
  would be needed to detect all post-arm touches.
- **Delivery is in-app** (a `notifications` table read by the header bell).
  Supabase Auth's mailer only sends auth emails, and adding a mail provider is a
  separate decision. Email or push can be added later as another consumer of the
  same table.
- **Per-user cap** of 20 notifications per run, so one user's long watchlist on
  a volatile day cannot become a flood.
- **Not written to `audit_log`.** That table records user actions; an alert
  firing is not one.

### Not in v1

**Signal alerts** ("RELIANCE turns STRONG_BUY"). No current out-of-sample trading
edge has been established. Recorded benchmarks in `ml/MODELS.md` predate the
validation corrections and require rerunning with the corrected harness.
Revisit signal alerts once a model demonstrates out-of-sample skill.

## Consequences

- Alerts are end-of-day, not intraday. A user who needs an intraday stop should
  use their broker's order types. The watchlist UI says "checked after market
  close" so the timing is not a surprise.
- Moving to Vercel Pro would allow per-minute schedules with no code change.
  Only the cron expressions would change, and intraday quotes would need a high/low
  since the last run rather than since the open.
- `CRON_SECRET` must be set in the Vercel project, or the route rejects every call.
