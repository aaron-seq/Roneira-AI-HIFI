# PRD: reproducible analyst research and honest forecasts

**Date:** 2026-10-20 · **Status:** research workflow and method disclosures implemented; prospective validation and model promotion remain proposed.

## Problem, users and goals

An analyst needs to understand a forecast's method, horizon, input availability and measured error before using it as research. Ordinary users need the same screen to explain limits without presenting a heuristic score as a probability of profit.

Goals are reproducible real-market experiments, independently reviewable evaluation and clear separation between candidates and serving. Non-goals are a 90% accuracy promise, autonomous trades, price guarantees, neural-model claims for tree regressors, or fees triggered by one favorable metric.

## Journeys and functional requirements

1. Select one stock, method and **observed trading-session** horizon. Show actual backend, input session/history, trained horizon, fallback state and excluded ensemble members before interpreting the target. Do not duplicate one call as separate short/long forecasts.
2. Compare methods and, later, multiple separately computed horizons. Each result has independent loading/unavailable status and a measured compute/rate-limit budget. Agreement describes proximity/direction, not calibrated confidence.
3. Run a frozen research configuration against permitted real data. Preserve request settings, hashes, source versions, temporal origins, resolved-label cutoffs and package versions. Raw histories and candidates stay in isolated ignored directories.
4. Review pooled, per-fold and per-instrument errors with matching baseline samples, direction/base-rate counts and unavailable coverage. Preserve negative results. Sequence models remain frozen within each fold; RF refits use only then-resolved labels through its actual serving path.
5. Later, freeze dated predictions before outcomes exist, resolve each after its actual requested sessions, and compare prospective results. Correction/revision history must remain distinguishable from originally available data.

Actual methods are RF regression, deterministic Technical/PVD rules, XGBoost sequence-feature regressors under historical `LSTM`/`GAN` aliases, and an equal-weight compatible-member blend. The existing released sequence bundle supports 30 sessions; research fits for 7/30/90/180 sessions are not automatically released. The GAN slot produces a point estimate, not scenarios or a probability distribution.

## Current evidence and metric contract

The [real-market report](../../ml/research/results-2026-10-19.md) uses six selected surviving equities, three chronological folds and 72/72/62/30 origins at 7/30/90/180 sessions. Both sequence slots have negative pooled skill at every horizon. The 180-session refitted ensemble's pooled skill is about +0.078, but final-fold skill is about −0.109 on 12 origins. No candidate was promoted.

Required metrics are return MAE/RMSE, signed skill `1 − MAE / MAE(no change)`, scored/total coverage, fallback reasons, nonzero direction correct/count, BUY/SELL precision and observed up/down/flat base rates. Compare each model to its baseline on the same outcomes. Cross-stock/overlapping outcomes are correlated; uncertainty estimates must respect that structure. Interval coverage requires width; directional accuracy is neither price accuracy nor net profit. Probabilities require separate calibration and Brier/log-loss/reliability evidence.

## Data, privacy and acceptance gates

Use the [market-data contract](market-data-prd.md). Publish only permitted aggregate evidence/configurations; private user predictions or acted-on trades require account controls and explicit consent before any secondary use.

| Gate | Measurable acceptance |
|---|---|
| M1 — causal/reproducible experiment | Every label ends exactly h source sessions after origin; training labels resolve before assessment boundaries; all input/config/source hashes verify; reruns reject altered cache bytes |
| M2 — truthful accounting | Reports include all predeclared origins or explicit unavailable reasons; negative skill and direction denominators survive serialization; held-out outcomes do not choose reported weights/parameters |
| M3 — candidate isolation | Research artifacts are marked and rejected by serving readiness, including accidental ML_MODEL_DIR selection; released bundle hashes and weights remain unchanged without reviewed promotion |
| M4 — prospective evidence, proposed | Prediction/algorithm/input hashes and issuance time precede outcome; session-based resolver handles holidays, suspensions and revisions; independent recomputation matches stored outcomes |
| M5 — promotion, proposed | A preregistered decision specifies horizons, coverage, baseline improvement and uncertainty before evaluation; fresh periods/instruments and prospective evidence support that decision; any trading claim adds costs/liquidity/risk evaluation |

There is no universal 90% gate. Thresholds and minimum effective sample sizes for M5 must be justified and frozen before a new assessment, not reverse-engineered from this report.

## Dependencies, risks, rollout and rollback

[#157](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/157) remains necessary before persisted calendar target dates can resolve session outcomes. [#180](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/180) covers legacy fabricated factor fields and clipped validation-score contracts. Present-day large-cap selection, revised adjusted data, correlated regimes and repeated research inspection limit generalization.

Release research tooling/results separately from serving changes. A promotion PR must identify exact trusted artifact hashes, compatibility metadata, validation evidence, inference resources and a previous-bundle rollback. Reject incompatible candidates rather than relabeling metadata. Revert to the previous trusted bundle or explicit unavailable state if readiness, provenance or drift checks fail.

## Backlog mapping

[#179](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/179) covers the current study; [#172](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/172) its numerical RSI correction. [#145](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/145) covers broader ensemble evidence, [#146](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/146) multi-horizon UX, and #157/#180 the contracts above. Proposed **#183** is a session-resolved forward prediction registry. Proposed **#188** is the independent evidence/release checklist and compatibility registry; these extend existing issues rather than asserting a trained candidate is approved.
