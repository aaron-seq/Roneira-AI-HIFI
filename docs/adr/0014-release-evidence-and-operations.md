# ADR 0014: Separate green CI, reviewed release and hosted readiness

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#12](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/12) · [#129](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/129) · [#133](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/133) · [#136](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/136) · [#140](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/140) · [#149](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/149) · [#150](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/150) · [#151](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/151) · [#174](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/174) · [#188](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/188) · [#199](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/199) · [#201](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/201) · [#203](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/203)

## Context

CI covers web/ML/data and disposable SQL/real GoTrue deletion. Deployment-file checks and passing unit tests do not prove a hosted service is configured or accurate. Dependency/runtime warnings and mutable action references remain maintenance work.

## Decision proposed

Record focused invariant tests, actual migrations and Auth HTTP lifecycle coverage as release evidence. Propose versioned model cards, trusted artifact hashes, reviewed promotion/rollback and operator evidence under #188. Use official compatible dependency/action upgrades with immutable references under #149; preserve scans and narrow permissions.

## Alternatives

Automatically equating build success with production readiness or model accuracy is rejected. Suppressing warnings, forcing incompatible downgrades or broadening a token to bypass a check obscures risk.

## Consequences and current limits

Disposable tests use generated secrets and own their containers. No hosted migration/deletion occurs here. The pre-commit ML hook uses bare python: activate the prepared Python environment; a pin file alone does not force interpreter selection. #199 corrects health uptime separately.

## Validation and delivery

Record exact commit/check results and source/data/artifact identities. For database changes prove baseline failure, SQL/RLS/tamper invariants and real GoTrue behavior. For docs use link/catalog checks; do not invent behavior tests. Refresh dated advisory evidence before changes.

## Decisions still required

Named release/operator ownership, actual deployment target, rollback exercise and service objectives are unassigned decisions. Existing gates can be specified now; future model promotion still requires #157/#183/#184 and fresh evidence without a dependency cycle.

## Sources

- [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- [supabase/tests/run-gotrue-deletion.py](../../supabase/tests/run-gotrue-deletion.py)
- [docs/product/delivery-plan.md](../../docs/product/delivery-plan.md)
