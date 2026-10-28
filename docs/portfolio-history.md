# Recorded portfolio history

Portfolio history adds observations of an account's current priced book. It does
not reconstruct unrecorded trades or calculate cash-flow-adjusted investment
returns. Product requirements are in the [portfolio PRD](product/portfolio-prd.md).

## Observation contract

Each account/currency has one capture per UTC calendar day. A new save replaces
that day's observation only when its capture time is not older than the stored
one. Missing days remain missing. INR and USD histories are separate.

A capture contains aggregate current marked value, included current holding cost
basis, unrealized P&L, percentage of positive basis, holding coverage, exclusions,
USD/INR when usable and provider/session metadata. It does not retain every
position's historical quantity, price or basis. It therefore cannot independently
reconstruct the historical book or establish a transaction ledger.

Three kinds of time stay separate:

- `holdingsObservedAt`: when the server observed the current holdings read.
- `capturedAt` / `valuedOn`: when the calculation was recorded and its UTC day.
- Source timestamps/session dates: the quote/FX observations, which may be older
  and may represent different exchange sessions. Missing provider as-of time is
  not replaced by capture time.

The server reads the book, fetches prices and rechecks a fingerprint before
saving. An edit detected during the quote request returns 409. This is a
best-effort observed-book check, not a transaction covering a broker ledger and
all market data at one atomic instant.

## Financial rules

The existing finite-value portfolio calculator is shared with current valuation.
Prices must be usable, FX finite and positive, quantities positive and costs
nonnegative. Quote currencies must match the holding denomination; USD/INR is
INR per USD. Known symbol metadata is used consistently for direct requests and
configured market groups.

Included cost and marked value use the same capture-time FX rate. Missing quotes,
conversion, invalid input or unsafe math exclude that holding explicitly. Partial
totals cover only the included subset. An empty book is zero; a nonempty fully
unpriced book is unknown. Zero cost basis permits monetary P&L but no percentage.

Unrealized P&L is marked value minus included current holding cost basis. It
excludes realized gains, cash flows, fees, taxes, dividends and historical FX
performance. Deposits, edits and changed positions can alter value between
captures without an investment gain.

## API and persistence

- `GET /api/portfolio/history?currency=INR&days=90`: authenticated owner history,
  currency INR/USD and 1–365 days. Default is INR/90. Duplicate/unknown parameters
  fail 400. Responses are private/no-store.
- `POST /api/portfolio/history` with only `{"currency":"INR"}`: authenticates,
  reads that user's holdings, obtains quotes/FX and calculates the capture on the
  server. It accepts no totals, target account, prices, date or backfill input.
- POST supports at most 200 holdings, has a per-user rate-limit bucket, rejects
  changed books with 409, and reports unavailable storage/configuration rather than a
  successful empty history. A lost response does not prove a write failed;
  refresh history before deciding what was saved.

Apply migration 013 before deploying the route/UI. The table
`portfolio_valuation_snapshots` has owner-only SELECT under RLS. Normal clients
cannot insert/update/delete it or execute the saving function. Server writes use
the service credential only after a real session has selected its own book.

`save_portfolio_valuation_snapshot(JSONB)` uses an ordered conflict update. If an
older request reaches the database late, it returns the already-newer stored row
rather than overwriting it. SQL constraints preserve finite values, valid
counts, matching UTC dates and unknown/empty/partial distinctions.

## Client behavior

The account-scoped history query/mutation observes an identity epoch as well as
user ID, so a batched A→B→A change invalidates old work while allowing new reads and
saves. Session checks run before requests and stale responses are rejected.

Opening the portfolio attempts a capture when today's entry is missing, with at
most one automatic attempt per client/account/currency/day. Failures do not
create render/retry loops. Explicit save and refresh actions remain available.
There is no unattended daily scheduler. A visit-free day is not backfilled.

The history chart includes only complete captures and breaks across missing or
partial dates. The exact-value table retains partial/unknown rows, coverage,
exclusions, source dates and FX. Current holdings remain editable during a history
storage error. Amounts are not labelled as investment returns.

## Validation and limits

### Recorded validation — PR191, 2026-10-19

[PR191](https://github.com/aaron-seq/Roneira-AI-HIFI/pull/191) records review of
out-of-order captures, A→B→A recovery, source-time handling and finite/partial
math, retaining market-helper regressions plus direct-symbol FX and
normalization-to-capture tests. The local stack passed 13 setup checks with
12 application migrations, real Auth/RLS/SSR and history SQL assertions;
397 web, 224 ML and 18 data tests, lint, types and build passed.

Browser checks covered 16 currency/viewport/theme states and 8 flows with
synthetic holdings and actual Yahoo quotes: unauthorized/forged requests,
daily idempotency, currency series, failure/retry, account isolation, overflow
and accessibility. The final mixed-currency capture covered all six fixture
holdings in both currencies. At that checkpoint, Auth hard-delete (#174) and
automated database/Auth CI (#188) remained follow-ups. These are historical
observations; provider availability remains environment-dependent.

![Synthetic portfolio holdings with actual quotes, INR history](portfolio-history-inr-390.png)

![The same observed book in a separate USD history](portfolio-history-usd-390.png)

### Current verification paths

Migration 015 repaired the account-deletion conflict; the
[audit-retention ADR](adr/0002-audit-retention-on-account-deletion.md) records
the contract and unresolved erasure policy. Database SQL and real GoTrue deletion
now run in CI; use the [database test guide](../supabase/tests/README.md) for
commands and scope. Hosted readiness and provider commercial permissions require
separate evidence; see the [data project](../data/README.md).

## Rollout and rollback

Deploy migration 013, verify grants/RLS and ordered-save assertions, then deploy
API/UI and check authenticated capture/read behavior against the intended target.
A rollback removes the UI/API integration first and retains private snapshot
rows/additive schema. Do not drop user history to roll back a visual change.

A complete ledger, realized P&L and proper investment-return attribution require
[#182](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/182) and
[#147](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/147). Do not relabel these
aggregate observations as that future accounting system.
