# ADR 0006: Preserve session horizons and correct persisted target-date semantics

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#146](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/146) · [#157](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/157) · [#171](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/171) · [#183](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/183)

## Context

Legacy aliases map to 1/7/30/90/180/365/400 observed sessions. The UI already says trading sessions; getTargetDate still adds that count as calendar days from now when saving prediction_history. The current chart shows horizontal model levels over historical candles, not a future-date projection.

## Decision proposed

Propose an explicit origin exchange/session, horizon unit and outcome-resolution contract. Preserve existing aliases and 30-session artifacts while fixing persisted date semantics. An unverified future calendar date must not masquerade as a resolved N-session outcome. Keep legacy rows distinguishable until a documented migration policy exists.

## Alternatives

Changing aliases to 21/63/252 sessions would change model targets and require new training/protocol evidence. Merely relabelling the already-correct UI does not fix saved dates. now+N calendar days is not session arithmetic.

## Consequences and current limits

Outcome resolution needs actual observed sessions, missing-bar/suspension policy and correction lineage. Calendar estimates and resolved observations must be distinguishable. No historical target-date backfill is authorized by this proposal.

## Validation and delivery

Cover weekends/holidays, exchange timezone boundaries, delayed/missing sessions, unknown future calendars, origin anchoring and legacy rows. Verify artifact horizon eligibility and API/UI units together.

## Decisions still required

Exchange-calendar authority, unknown-date representation, correction/delisting behavior and legacy migration are review decisions under #157/#183. Do not silently switch existing model horizons.

## Sources

- [ml/app/horizons.py](../../ml/app/horizons.py)
- [src/lib/market/timeframe.ts](../../src/lib/market/timeframe.ts)
- [src/app/api/predict/route.ts](../../src/app/api/predict/route.ts)
