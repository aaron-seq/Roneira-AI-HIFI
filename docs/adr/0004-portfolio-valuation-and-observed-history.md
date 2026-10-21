# ADR 0004: Separate portfolio value, unrealized P&L and observed history

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#31](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/31) · [#133](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/133) · [#147](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/147) · [#166](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/166) · [#178](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/178) · [#190](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/190)

## Context

An ordinary portfolio owner needs current value and gain/loss, plus past observed values. Current holdings can be edited and do not establish past transactions or cash flows.

## Decision proposed

Record the implemented currency-aware valuation and private daily captures, one observation per UTC day/display currency. Disclose missing quote/FX coverage and retain the actual capture context. Show observed value change separately from investment return; never backcast a historical portfolio from today's holdings.

## Alternatives

Recomputing old values from the current book invents positions and FX. Treating missing prices as zero creates false losses. Claiming returns from snapshot differences ignores contributions/withdrawals.

## Consequences and current limits

History begins at an observed capture; unvisited days stay missing. Partial captures are distinguishable from complete captures. Unrealized P&L is based on available user-supplied basis and prices, not reconciled realized accounting.

## Validation and delivery

Check owner isolation, same-day currency uniqueness, partial quotes/FX, empty history and exact chart/table values. #190 must unify source/session/freshness semantics across consumers.

## Decisions still required

Automatic scheduled captures, backfills and transaction-aware return methods need separate scope. #182/#147 gate realized P&L, cash-flow-aware returns and attribution.

## Sources

- [docs/product/portfolio-prd.md](../../docs/product/portfolio-prd.md)
- [docs/portfolio-history.md](../../docs/portfolio-history.md)
- [src/lib/portfolio/history.ts](../../src/lib/portfolio/history.ts)
