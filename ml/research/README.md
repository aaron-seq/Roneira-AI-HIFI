# Reproducible real-market training

`research.py` trains separate return-forecast tasks from one frozen Yahoo Finance
input set. It does not change the application's deployed model bundles.

```bash
cd ml
../.venv/bin/python research.py --config research/real-world-2026-10-19.json
```

Use the project's supported Python environment and `ml/requirements.txt`. The
checked configuration preselects four Indian and two US surviving liquid equities,
2016-10-17 inclusive through 2026-10-17 exclusive, daily adjusted OHLCV,
7/30/90/180 observed-session horizons, three chronological folds, seed 42,
at most 24 origins per fold and two workers. These are research tasks rather than
claims that all those horizons are deployed. A 90-session forecast is not a
validated year-long forecast; 365 observed sessions is not a calendar year.

## Data and reproducibility

The first run downloads each ticker once, records explicit provider request
settings, exchange timezone, rows, dates, retrieval time and CSV SHA-256, then
fits from the CSV round-trip. Subsequent runs reuse those exact bytes and fail
on a hash/request mismatch. `--refresh` explicitly replaces the inputs and their
hashes. A later Yahoo download may revise adjusted history; matching date ranges
alone do not reproduce this measurement. `protocol.json` records configuration,
source hashes and package versions before any scoring.

Raw input, per-origin prices/returns and joblib candidates stay under ignored
`ml/.cache/research/<name>/`. Use a new research name/output directory for a new
experiment. Only publish aggregate reports, methodology and provenance when
provider rights permit. The source-code license does not license Yahoo or other
providers' market data. Yahoo-adjusted data are retrospectively revised research
inputs, not point-in-time records or a guaranteed commercial feed.

## Training and assessment

Every sequence window includes its origin row; its label is the adjusted-close
return to exactly `h` observed sessions later. Both historical `LSTM` and `GAN`
identifiers use deterministic XGBoost regressors with their existing 60×11 and
30×6 feature windows. They are neither neural LSTMs nor adversarial GANs.
No new dependency or hyperparameter search is used. Tree defaults are frozen:
300 estimators, depth 4, learning rate 0.05, row/column sample 0.9, L2=1, seed 42,
histogram splits. Requests and research use at most two workers by default.

At each fold, sequence training labels must resolve strictly before the fold
starts, using actual source timestamps rather than a calendar-day estimate.
Sequence artifacts stay frozen within each fold. Random Forest follows its
actual serving path: it fits 200 depth 12 trees at each origin on the shared
bounded trailing history, using only then-resolved labels; its internal
chronological validation also purges unresolved labels. Later assessment origins
can legitimately learn labels that resolved earlier in the same fold. This is
prequential assessment, not an assertion that every model is frozen before the
whole final fold. Technical and PVD Momentum are explicit indicator rules.

Origins are spaced at least one horizon apart per instrument before fixed-seed
subsampling. The final chronological fold is reported separately. Parameters and
weights are not selected using assessment results. This selected-instrument
sample is not an unseen-instrument test, and historical replay is not prospective
paper trading. Cross-stock outcomes share regimes; counts are not independent
Bernoulli trials.

Individual-model metrics score normal served prediction methods, including their
return clips, price rounding and fallback checks. Ensemble rows are offline
recombinations of those recorded returns using production weights/eligibility;
they omit the combiner's final cent rounding, so they are not bit-for-bit API
output. MAE is forward-return error; signed skill is `1 - MAE / MAE(no change)`. Negative is worse than the
no-change baseline. Directional hit rate includes only nonzero predictions, with
explicit correct/directional counts and realized up/down/flat base rates. A flat
outcome is not a downward move. Coverage and per-fold/per-ticker metrics prevent
an unavailable forecast or dominant ticker being hidden by a pooled average.
These metrics are not net trading P&L or calibrated confidence probabilities.

## Candidate safety and promotion

Each horizon gets its own candidate directory. Saved candidates are the final
fold's pre-assessment sequence fits; their metadata exposes the last training
origin/label time. They are marked `research_only: true` and the serving contract
rejects them, even if `ML_MODEL_DIR` accidentally points there. The default
30-session deployed bundle is unchanged. Never relabel one horizon as another.

Promotion needs a separately reviewed change with prospective monitoring,
unseen instruments/regimes, reproducible independent temporal validation,
comparison with appropriate baselines, data rights and a strategy evaluation
including costs/liquidity where trading performance is claimed. A 90% aspiration
or an uncalibrated confidence field is insufficient evidence for fees.

## Numerical correction

Random Forest and Technical rules now share simple rolling RSI boundary handling:
after 14 finite changes, all gains/no losses=100, all losses/no gains=0 and
no movement=50. Missing data and warm-up stay unavailable. This fixes loss of the
current RF feature origin in sustained rises/flat histories (issue 172).
Persisted sequence feature extraction is unchanged: changing its trained RSI
encoding without a versioned retrain would violate artifact compatibility.

Run `../.venv/bin/python -m pytest tests -q` from `ml/`. Offline tests use synthetic
inputs to verify numerical, timestamp and cache invariants; they do not establish
market forecasting accuracy. The separate report records actual provider runs.
