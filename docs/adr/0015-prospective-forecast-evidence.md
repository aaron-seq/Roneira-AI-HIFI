# ADR 0015: Version issued forecasts before measuring future outcomes

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#145](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/145) · [#146](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/146) · [#183](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/183) · [#186](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/186) · [#188](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/188) · [#202](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/202)

## Context

Private prediction_history saves responses but is not a versioned prospectively scored forecast registry. Its target_date still has legacy calendar arithmetic. Cross-horizon agreement is correlated and does not establish accuracy.

## Decision proposed

Propose immutable issuance evidence: actual origin/session, requested/trained horizon, input/config/model hashes, eligible members and unavailable state. Resolve outcomes idempotently from permitted actual exchange-session observations with correction lineage and visible unresolved reasons. Freeze scoring/protocol before collecting outcomes.

## Alternatives

Reconstructing issued predictions later or scoring only surviving successful forecasts creates hindsight/coverage bias. Reusing the final historical fold for ensemble tuning is not independent assessment. Concurrent React Query mutations do not automatically dedupe inference.

## Consequences and current limits

#157 blocks outcome semantics. #184 gates public data/output uses; synthetic/private schema design can proceed. #146 must handle per-horizon eligibility/errors and measured bounded inference cost, not promise historical latency. #186 adds execution/cost methodology beyond forecasts.

## Validation and delivery

Test duplicate resolution, holidays/suspensions/delistings, missing/revised bars, privacy, artifact/horizon changes, denominator/coverage and predeclared baselines. Later report forward error/direction separately from net trading profit.

## Decisions still required

Correction/as-of policy, registry retention/access, prospective success criteria and resource budget require review. #188 can implement evidence schemas independently; neither #183 nor #188 should block all design work on the other.

## Sources

- [docs/product/analyst-research-prd.md](../../docs/product/analyst-research-prd.md)
- [supabase/migrations/002_prediction_history.sql](../../supabase/migrations/002_prediction_history.sql)
- [ml/research/README.md](../../ml/research/README.md)

## Existing-row trust prerequisite

[#202](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/202) must repair broadly permissive prediction-history writes before registry/outcome integrity claims. Do not relabel historical rows as immutable or verified merely after tightening future access.
