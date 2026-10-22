# ADR 0008: Freeze real-market studies and retain negative evidence

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#144](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/144) · [#145](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/145) · [#162](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/162) · [#167](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/167) · [#172](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/172) · [#179](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/179) · [#188](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/188) · [#207](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/207)

## Context

The six-stock Indian/US historical study trained research candidates at 7/30/90/180 sessions. Sequence candidates had negative pooled skill at every horizon; the 180-session ensemble gain did not survive the final temporal fold. This selected-stock replay is not a live trading result.

## Decision proposed

Record frozen data/config/artifact hashes, chronological fitting with exact label purging and unchanged assessment definitions. Keep research_only artifacts out of serving. Compare signed return-error skill to no-change on identical outcomes, direction to base rates, and valid/total coverage. Preserve unsuccessful fits and excluded origins.

## Alternatives

Tuning on the reported final fold contaminates it. Training completion or 90% of an undefined score cannot gate release. Automatic promotion based on an attractive pooled metric ignores regimes and selection.

## Consequences and current limits

Historical adjusted/revised data, surviving large caps and correlated origins limit inference. Future tuning consumes a development sample; stronger claims need genuinely untouched/prospective outcomes. Optional GAN vectorization #167 was reviewed, not evidence of an implemented model improvement.

## Validation and delivery

Reproduce the frozen protocol, split/purge boundaries, hashes, baseline denominators, per-fold metrics and unavailable reasons. Confirm serving rejects research_only candidates; gate promotion separately in #188.

## Decisions still required

Future universes, protocol success criteria, compute budget and independent reviewer must be declared before observing new assessment outcomes. No newly trained bundle or ensemble weight is approved.

## Sources

- [ml/research/README.md](../../ml/research/README.md)
- [ml/research/results-2026-10-19.md](../../ml/research/results-2026-10-19.md)
- [ml/MODELS.md](../../ml/MODELS.md)

## Input-cache follow-up

[#207](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/207) tracks ordinary backtest downloads cached before minimum-row eligibility checks. Repair unusable-cache acceptance without silently refreshing valid frozen study inputs.
