# Roneira AI HIFI — model behavior and validation

`ml/` is the deployed FastAPI service. The six selection names are API aliases;
**LSTM** and **GAN** are currently sequence-feature slots backed by fitted,
deterministic gradient-boosted regressors. TensorFlow is not an installed
runtime dependency. Neither deployed slot produces a distribution of future
prices, and the selection names alone do not establish prediction quality.

## What each selection does

| Selection | Current implementation | Training | Useful information | Limits |
|---|---|---|---|---|
| Random Forest | 200 bagged trees, maximum depth 12, returns and technical features | Fits the requested horizon on the supplied historical window | A learned return estimate and its influential features | Retrains per request; history and resolved labels limit validation |
| LSTM | Gradient-boosted regression over 60 ordered feature rows | Offline, for a recorded session horizon | A learned sequence-feature point estimate | Requires a compatible artifact; requesting another horizon uses a flagged fallback |
| GAN | Gradient-boosted regression over 30 feature rows | Offline, for a recorded session horizon | A second learned sequence-feature point estimate | Ignores latent noise; produces no simulated paths or calibrated interval |
| Technical | Fixed indicator rules | None | RSI, MACD, trend and volume indicator votes | A heuristic price projection; no trained forecast accuracy |
| PVD Momentum | Fixed price/volume derivative rules | None | Momentum and volume context | Rule thresholds and confidence are heuristics |
| Ensemble | Available Random Forest, Technical, PVD Momentum and LSTM results | Inherits member training | Member estimates, disagreement and effective weights | Excludes fallback members; fewer members change the blend |

Random Forest, Technical and PVD Momentum need no offline artifact. The
Ensemble starts with equal configured weights of 0.25. Unavailable or fallback
members receive no weight, and eligible weights are renormalised. It reports
excluded members and the resulting component weights. Agreement does not earn
an extra confidence bonus: closely clustered forecasts can all be wrong.

The confidence/model scores are **heuristics**, not the probability of an
upward move or profitable trade. Scores from different model families use
different formulas and are not calibrated for comparison. Fundamental and
news sentiment analysis are not trained input features in these predictors;
the legacy confidence breakdown should not be read as evidence of either.

## Session horizons and serving history

`horizon_days` counts **observed trading sessions**, despite its legacy name.
The web aliases continue to mean 1, 7, 30, 90, 180, 365 and 400 sessions; a week
or month label is not an exchange calendar conversion. Target dates stored by
the web app are calendar dates and do not prove when an exchange session will
occur. Issue #157 tracks the remaining date/calendar contract work.

Serving and evaluation share `app/horizons.py`:

```python
lookback = max(504, 4 * horizon_sessions + 200)
```

The service fetches 5 or 10 years, then tails the result to that session
budget. Fetching extra calendar history avoids assuming that two years contain
504 exchange sessions. This gives Random Forest more resolved training labels and validation
history than the former one-year request. A young listing or suspended stock
can still have too little history; the result must disclose that limitation.

## Training and leakage boundaries

Both deployed sequence slots use their own feature functions and CPU
regressors in `app/models/gradient_boost.py`. Training windows include the
**origin session** as their final feature row. Their label is the return from
that origin's close to the close `horizon_days` observed sessions later. This
matches inference, which receives data through the latest known close.

Pooled windows are ordered by origin timestamp across instruments. The
chronological validation split admits a training row only when its actual
label-resolution timestamp is strictly earlier than the first validation
origin. Missing sessions, market holidays and suspensions therefore cannot
make a calendar-day estimate admit unresolved outcomes. An optional additional
calendar embargo can remove more rows; it does not replace label availability.

Validation reports MAE, RMSE, the no-change MAE, and **unclipped** skill against
that baseline. Negative skill remains visible. A validation split with fewer
than 500 resolved training windows is rejected. Validation weights or metrics
must never be fitted from the held-out outcomes. The saved artifact is the
training-split estimator evaluated on that held-out period; validation outcomes
are not subsequently folded into its fit.

Artifact metadata records the training horizon and
`window_contract="origin-inclusive-v2"`. Inference rejects incompatible
horizons/contracts and mismatched feature widths through a flagged fallback.
Existing artifacts trained on the older origin-exclusive windows require
retraining; an old artifact cannot become compatible by changing its metadata.

```bash
cd ml
python train_models.py --backend gradient-boost --models all --horizon 30
python -m pytest tests/test_training.py tests/test_models.py
```

The optional TensorFlow training entrypoints are blocked as experimental and
unvalidated, and inference loads only gradient-boosted artifacts. Restoring
neural training requires a separately reviewed causal feature, label and
validation contract. The gradient-boosted benchmark below does not validate a
recurrent network or generative model.

Random Forest constructs forward-return targets only when the future close is
already present in its input prefix. Its three internal chronological folds
purge by each label's actual resolution timestamp. Features can drop rows, so
source-session timestamps are used rather than counting retained feature rows.
No scaler is fitted on validation data. Folds without resolved training data
cannot contribute an invented validation score.
If feature preparation cannot supply the latest input session, the predictor
returns an explicit fallback instead of anchoring an older feature row to the
latest price.

## Walk-forward evaluation

`backtest.py` evaluates forecasts rather than executing trades. For every
origin it calls each predictor on the same trailing session window production
uses, with no data after that origin. The sequence slots are refitted for the
requested horizon before each fold, using only labels already observable
strictly before the fold starts. The harness does not use the shipped artifact
to score dates before that artifact was trained.

```bash
cd ml
python backtest.py --models all --tickers RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS \
  --period 10y --folds 4 --horizon 7 --max-origins-per-fold 12 \
  --json results-7.json --records origins-7.csv
python -m pytest tests/test_backtest.py
```

By default origins are one horizon apart per stock, so its forward returns do
not overlap. Cross-stock outcomes can remain correlated. Fold edges are shared
calendar periods across stocks. The optional origin cap uses deterministic
sampling, not a selection based on realised outcomes.

A fallback, invalid price or inference error is an **unavailable model
prediction**. Its return is missing and its reason is recorded; it cannot be
scored as a fitted model that successfully forecast no change. Reports include
scored/total origin coverage. The production ensemble renormalises eligible
members, reports degraded blends, and is evaluated with those actual weights.
Full-member equal-weight and inverse-MAE variants require complete predictions.
The fixed RF + Technical + PVD Momentum blend is also reported. With a bundled
30-session sequence artifact it matches the live seven-session ensemble's
eligible members when the three are available. Fold refits of seven-session
sequence models are research models, not the shipped 30-session bundle.
Inverse-MAE weights learn only from complete earlier-fold labels whose actual
resolution timestamps precede the scored fold.

Metrics are:

- MAE of predicted forward returns, alongside the no-change MAE.
- Skill `1 - MAE / baseline_MAE`, including negative results.
- Per-fold skill and the number of folds beating no change.
- Directional hit rate among nonzero forecasts, and BUY/SELL precision compared
  with the observed up/down base rate.
- Prediction coverage and degraded ensemble count.

No transaction costs, liquidity, position sizing or realised trading P&L are
modelled. Better forecast metrics in a small sample do not establish a trading
edge. Broader unseen instruments, periods and costs remain necessary to
validate a strategy. Issue #145 tracks broader ensemble validation.

## How to use the results screen

Choose Technical to inspect indicator votes, PVD Momentum to inspect momentum
and volume inputs, or Random Forest to inspect a fitted return estimate.
Choose Ensemble to inspect where eligible members agree or disagree. A
sequence slot should be selected only for its recorded compatible horizon.

Read the history timestamp, requested sessions, backend and fallback state
before the estimate. Treat model disagreement as information to investigate;
it is not a calibrated risk interval. A neutral HOLD vote means the engine
lacks directional conviction, not a guarantee that price will remain flat.

## Historical benchmark caveat

The 2026-10-09 benchmark used the earlier window and validation contracts.
Review subsequently found unresolved sequence labels in a calendar-based
purge, unresolved outcomes in inverse-MAE weights, unpurged Random Forest
validation and an off-by-one sequence origin. Its numbers are retained in Git
history and must not be cited as current accuracy. The new Indian-equity
comparison is recorded in
[`docs/ml-validation-2026-10-11.md`](../docs/ml-validation-2026-10-11.md), with
identical cached histories and origin dates. Accuracy changes were mixed;
the small diagnostic does not establish a stable advantage over no change.

## Contributing a model

Implement the standard prediction result, expose readiness, register the
selection in `app/main.py`, and keep offline fitting out of inference requests.
Record the actual backend, feature/window contract, training horizon,
validation cutoffs and no-change baseline. Add regression tests for causal
feature/label alignment and unavailable inference. Re-run a fixed, documented
walk-forward protocol before changing weights or making performance claims.
