# PRD: understandable portfolio value and performance

**Date:** 2026-10-20 · **Status:** valuation/history implemented in the current change; transaction accounting proposed.

## Problem, users and scope

A portfolio owner needs to understand current value, gains/losses and past values without mistaking missing data, new contributions or edited holdings for investment performance. A returning user also needs a reliable record when current prices or holdings change.

Primary users are ordinary Indian/US equity holders, including mixed INR/USD portfolios. Analysts reviewing their own decisions are a secondary audience.

Goals are clear current unrealized P&L, private recorded history, and an explicit path toward transaction-aware performance. Initial history does not provide realized gains, complete cash accounting, tax reports, brokerage execution, advice, automated rebalancing, or time-weighted/money-weighted returns.

## Journeys and requirements

1. **Understand today.** Add/edit holdings, inspect native-currency position values and base-currency totals. Show included cost basis, unrealized P&L, priced coverage and exclusions. Zero cost basis retains the monetary gain with an unavailable percentage. A nonempty unpriced book has unknown totals; an observed empty book is zero.
2. **Return later.** Opening a portfolio attempts a capture when today's UTC entry is missing; explicit save can replace that currency/day's entry. Display recorded value, included cost, P&L, coverage and sources in an exact table. Chart only complete captures, with gaps for missing/partial days. No unattended daily schedule is implied.
3. **Recover.** Quote/history/save failures expose retry or refresh controls while preserving editable holdings. A failed POST response may follow a committed save; offer refresh to confirm instead of promising that storage was unchanged.
4. **Explain the record.** Separate holdings-observation time, capture time, provider timestamp and exchange session. Explain that editable-book capture is not an atomic broker ledger. Snapshots preserve aggregate figures and source evidence, not reconstructable historical position composition.
5. **Later: account for transactions.** Record buys, partial sells, re-entry, cash movements, dividends, splits and fees with instrument/currency/event times. Use corrections or reversals rather than silent historical rewrites. Reconcile the ledger to holdings and identify imported opening balances. Choose and display a cost-basis convention before reporting realized P&L. Add returns only after cash-flow and historical-FX boundaries are verified.

## Data, financial and privacy requirements

Server-calculated captures accept currency only; clients cannot supply totals, another account, sources or past dates. Own-account reads use verified identity and RLS; trusted persistence remains service-only. Private responses are not publicly cached. Older requests cannot overwrite newer captures. Account switches, including A→B→A, discard stale results and permit fresh work.

Each capture records currency, observed/captured UTC times, included cost/value, generated P&L, nullable percentage, holding counts, coverage, FX, exclusions and quote provenance. Missing/invalid quotes, mismatched currencies and unusable FX remain explicit. Current FX applied to both value and basis does not recover acquisition-date FX effects.

Future ledger imports need explicit ownership, validation, idempotency, source IDs, versioned corporate-action treatment and reconciliation. Users must approve imported records before they affect balances. Export/deletion policies must resolve audit retention safely; never publish real holdings as an open dataset.

## Acceptance and evidence gates

| Gate | Measurable acceptance |
|---|---|
| P1 — current/history correctness | Deterministic fixtures cover empty, fully unpriced, partial, zero-basis, mixed currency, bad FX and overflow; stored P&L equals included value minus included basis |
| P2 — privacy/concurrency | Actual anonymous/cross-user access and direct write/RPC attempts are denied; newer-then-older saves retain the newer record; stale account requests cannot update the active view |
| P3 — usable history | Exact table agrees with returned snapshots; chart gaps remain gaps; keyboard/mobile loading, partial, error and recovery states pass browser checks |
| P4 — ledger readiness, proposed | Partial sell/re-entry, dividend, split, fee and duplicate-import fixtures reconcile cash, quantity and documented cost basis; all unresolved discrepancies are visible |
| P5 — performance release, proposed | External-cash-flow fixtures reconcile before/after valuations; TWR/MWR and attribution are independently recomputed under documented conventions; no return shown where required inputs are missing |

The current change targets P1–P3. Passing them does not satisfy P4–P5.

## Dependencies, risks and rollout

Dependencies include quote quality/currency contracts, migration 013 and private Auth/RLS. Migration 015 repairs [#174](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/174)'s audit/delete compatibility under [ADR 0002](../adr/0002-audit-retention-on-account-deletion.md). Erasure and retained-data policy remain unresolved in [#196](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/196). Data revisions, edited holdings and current FX can change what users infer; surface those limits rather than smoothing the series.

Apply the additive migration to a verified development target, run disposable SQL/Auth checks, then release capture UI after review. To roll back, revert/disable UI and capture routing while retaining private saved rows; do not drop history or weaken RLS. Future accounting should launch with a reconciled test/import cohort and an exportable correction trail; stop new imports/calculation display if reconciliation fails.

## Backlog mapping

- [#178](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/178): current private capture/history slice.
- [#147](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/147): journal, realized P&L and attribution; requires validated ledger completeness first.
- [#174](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/174), [#176](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/176): account lifecycle and recovery dependencies.
- Proposed **#182**: append-only transaction/cash-flow records, idempotent import and holdings reconciliation; subordinate delivery to #147, not a parallel accounting implementation.
- Proposed **#190**: source freshness, quote currency and coverage contracts; see the market-data PRD.
