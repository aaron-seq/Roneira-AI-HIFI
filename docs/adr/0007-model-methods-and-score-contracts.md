# ADR 0007: Expose actual algorithms, unavailable forecasts and honest scores

- **Status:** Proposed — human review requested, 2026-10-21.
- **Review record:** [#198](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/198); no approval inferred from existing code or merges.
- **Related issues:** [#142](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/142) · [#143](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/143) · [#145](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/145) · [#158](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/158) · [#171](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/171) · [#172](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/172) · [#180](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/180) · [#181](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/181) · [#192](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/192)

## Context

LSTM and GAN are legacy API names for XGBoost sequence-feature point regressors, not recurrent/adversarial networks. RF fits requested horizons; Technical/PVD are rules. Heuristic confidence and feature importance are not calibrated probabilities or causal/fundamental evidence.

## Decision proposed

Record current backend/horizon/fallback provenance and eligible-member equal-weight serving blend. Exclude failed or incompatible members and disclose degradation. Propose completing #180 API score/factor semantics, retaining signed validation skill, and #181 invalid-projection handling without rewriting historical results. Existing UI removal of misleading tiles is not API calibration.

## Alternatives

Renaming persisted identifiers immediately breaks consumers. Presenting a fallback as a successful zero-change prediction or correlated agreement as accuracy misleads users. A score clamp can hide negative skill.

## Consequences and current limits

The sequence bundles serve only their trained 30 sessions. Model fit, readiness, agreement and a price range establish neither probability nor strategy profitability. No candidate or weight change is approved here.

## Validation and delivery

Check actual method metadata, unavailable/degraded states, requested/trained horizon mismatch, signed poor validation scores and nonpositive Technical projections. Recompute blend weights over eligible members.

## Decisions still required

Choose a versioned compatibility/deprecation contract for score fields and invalid projections in focused PRs. Calibrated probabilities require a separate target, dataset and prospective assessment.

## Sources

- [ml/MODELS.md](../../ml/MODELS.md)
- [ml/app/models/ensemble.py](../../ml/app/models/ensemble.py)
- [docs/model-design-review-2026-10-11.md](../../docs/model-design-review-2026-10-11.md)
