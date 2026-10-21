# ADR 0009: Govern provider rights, provenance, freshness and revisions

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#28](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/28) · [#29](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/29) · [#30](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/30) · [#32](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/32) · [#33](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/33) · [#128](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/128) · [#159](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/159) · [#168](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/168) · [#184](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/184) · [#185](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/185) · [#190](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/190) · [#207](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/207)

## Context

Open-source code does not grant provider redistribution rights. Different feeds have different sessions, currencies, delays, revisions and entitlements. Registry/schema validation exists; shared purpose enforcement and full quality contracts remain open.

## Decision proposed

Propose a provider/plan/exchange/purpose evidence matrix with unknown public uses disabled, explicit personal-development scope and source-to-normalized-contract lineage. Distinguish source/session time from receipt time, unknown from stale, and partial from complete currency coverage. Version revised datasets; test corporate actions and survivorship explicitly.

## Alternatives

Treating a free API key as public display permission or all downloaded bars as open data is unsupported. Universal TTL thresholds hide feed differences. Dropping revised/missing observations silently changes a study.

## Consequences and current limits

Authored synthetic fixtures and code can be public. Restricted raw histories, private portfolios and provider credentials stay outside Git. Private research access is not evidence of public or commercial rights.

## Validation and delivery

#184: permitted/unknown/denied purpose tests. #185: synthetic splits, dividends, missing/duplicate sessions, revisions and universe lineage. #190: wrong-currency FX, stale/unknown timestamps, exclusions and consumer consistency. #168: exported public pipeline behavior regressions.

## Decisions still required

Actual contract/plan permissions and evidence-derived freshness thresholds require review. No SLA, redistribution grant or paid plan purchase is inferred. Existing provider fallback/cache/bounds repairs remain implemented baseline, not complete entitlement enforcement.

## Sources

- [data/README.md](../../data/README.md)
- [data/registry.json](../../data/registry.json)
- [docs/product/market-data-prd.md](../../docs/product/market-data-prd.md)
- [src/lib/server/market.ts](../../src/lib/server/market.ts)
