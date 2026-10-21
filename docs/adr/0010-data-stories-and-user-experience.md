# ADR 0010: Explain actual data with visible coverage and accessible evidence

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#138](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/138) · [#141](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/141) · [#175](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/175) · [#176](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/176) · [#187](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/187) · [#188](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/188) · [#190](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/190) · [#205](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/205)

## Context

Users need understandable portfolio concentration, gains/losses and market movement. Implemented stories use normalized quotes/current books; a persuasive narrative can otherwise hide missingness or imply causation.

## Decision proposed

Record deterministic source → calculation → narrative stories with currency, session, coverage, method and missing/error states beside the insight. Preserve exact-value tables and accessible controls. Propose shared contract/release fixtures through #190/#188 and consented comprehension testing through #187.

## Alternatives

Invented statistics, synthetic values presented as live data and causal/model explanations unsupported by inputs are rejected. A chart alone is insufficient for precise or accessible reading.

## Consequences and current limits

Implemented stories and mobile/component checks do not establish user satisfaction. Account transitions must clear private state while public queries recover; richer narratives must not leak another account's book.

## Validation and delivery

Cover complete/partial/empty/error stories, mixed FX, unknown sessions, keyboard/screen-reader controls and account switch/logout. Measure ordinary-user interpretation of value versus return and model score versus probability in the pilot.

## Decisions still required

Pilot recruitment/consent, comprehension criteria, minimal telemetry and retention require review. No user outreach, analytics enrollment or measured success rate is inferred.

## Sources

- [docs/data-stories-2026-10-13.md](../../docs/data-stories-2026-10-13.md)
- [src/lib/insights/stories.ts](../../src/lib/insights/stories.ts)
- [docs/product/portfolio-prd.md](../../docs/product/portfolio-prd.md)

## Remaining entry-flow defect

[#205](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/205) fixes a landing preview that promises anonymous live inference while its endpoint requires authentication. Preserve the authenticated API boundary and make the UI truthful.
