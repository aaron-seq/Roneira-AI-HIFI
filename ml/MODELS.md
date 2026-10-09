# Roneira AI HIFI — ML Models Review & Comparison

This document reviews every prediction model shipped in the platform, explains
how they work, and gives concrete guidance on **which model to use when**. It is
the reference for the model-selection logic in `ml/app/main.py` and for
contributors adding or tuning models.

> **Scope note.** `ml/` is the only Python service in this repo — the FastAPI
> backend (`app.main:app`) with six pluggable models and offline-trained
> LSTM/GAN artifacts. An older `ml-service/` tree shared the PDM lineage as a
> separate deployment; it was never wired into CI or deployed alongside `ml/`,
> and has been deleted. Git history has it if the backtesting code there is ever
> wanted.

---

## The six models at a glance

| Model | Family | Learns from data? | Training | Inference cost | Best horizon | Key strength | Key weakness |
|---|---|---|---|---|---|---|---|
| **Random Forest** | Supervised ML (bagged trees) | Yes | Online, per-request | Low–Medium | 1w – 3m | Robust, non-linear feature interactions, no GPU | Poor extrapolation beyond training range; retrains each call |
| **LSTM** | Deep learning (recurrent NN) | Yes | **Offline** (`train_models.py`) → `.keras` artifact | Medium (CPU) / Low (GPU) | 1m – 1y | Captures temporal sequence structure | Needs TensorFlow + a trained artifact; falls back otherwise |
| **GAN** | Deep learning (generative) | Yes | **Offline** → generator artifact | Medium | 1m – 6m | Models a *distribution* of trajectories, not a point | Hardest to train/validate; can hallucinate; artifact-dependent |
| **Technical Analysis** | Rule-based (no ML) | No | None | Very low | tomorrow – 1w | Deterministic, explainable, instant | No learning; blind to regime it wasn't coded for |
| **PVD Momentum (PDM)** | Rule-based + calculus | No | None | Low | 1w – 1m | Institutional-flow / momentum capture via price & volume derivatives | Momentum strategies whipsaw in choppy/sideways markets |
| **Ensemble** | Meta-model | Combines the above | Inherits | Sum of members | 1m (general default) | Diversification lowers variance of any single model | Only as good as its members; highest latency |

“Learns from data?” distinguishes the statistical/deep models (which fit
parameters) from the rule-based engines (which apply fixed formulas).

---

## Model-by-model review

### 1. Random Forest — `app/models/random_forest.py`
A `RandomForestRegressor` (200 trees, depth 12) over ~20 engineered features:
multi-horizon returns, SMA/EMA ratios, RSI, MACD, volatility, and volume ratios,
validated with `TimeSeriesSplit` to avoid look-ahead leakage.

- **Use it when** you want a dependable, CPU-only, non-linear baseline and can
  tolerate the model retraining on the fetched window each request.
- **Watch out for**: tree ensembles cannot extrapolate — a genuine breakout to
  new all-time highs will be under-predicted because no training row covers that
  range. It is a mean-reverting-friendly model.

### 2. LSTM — `app/models/lstm.py`
A recurrent network trained **offline** by `ml/train_models.py` and saved as a
`.keras` artifact (60-step sequences). At runtime it only *loads* the artifact;
if TensorFlow or the artifact is missing it degrades to a documented fallback
rather than crashing.

- **Use it when** temporal ordering matters (trend persistence, multi-day
  momentum) and you have run offline training to produce an artifact.
- **Watch out for**: without a trained artifact it is not doing deep learning at
  all — check `is_ready()` / the health endpoint before trusting it.

### 3. GAN — `app/models/gan.py`
A conditional generator (also offline-trained) that maps a latent vector plus
the recent price window to a forward return. Inference makes **one** call at the
latent mean (zero noise) and reports that central estimate.

It does **not** report a spread. The deployed backend is the gradient-boosted
artifact (TensorFlow is not a dependency), which ignores the noise input, so
sampling it repeatedly returned identical values and the old "Prediction Std"
indicator was always exactly 0 (#143). Confidence comes from validation error.
A real interval would need quantile regressors — see the `ponytail:` note in
`gradient_boost.py`.

- **Use it when** you want a second sequence model's point estimate alongside
  the LSTM slot.
- **Watch out for**: GANs are the hardest to validate; treat outputs as scenario
  generation, not precise forecasts. Artifact-dependent like the LSTM.

### 4. Technical Analysis — `app/models/technical_analysis.py`
Pure rule-based engine over nine indicators: RSI, MACD, Bollinger Bands,
Stochastic RSI, ADX, EMA crossovers, Supertrend (10,3), Ichimoku Cloud and
Anchored VWAP. No training, fully deterministic and explainable.

Each indicator votes Buy / Sell / Neutral and the verdict is the **net vote**,
`(buy - sell) / total`, mapped by `_aggregate`. Two properties that matter:

- **Neutral means neutral.** An indicator that abstains reduces conviction; it
  does not add direction. The previous aggregate was `buy / total`, which counted
  every abstention as evidence against buying and never read `sell` at all — a
  flat tape with one buy, one sell and four abstentions was reported as `SELL`,
  and a sustained downtrend with a 2-2 mean-reversion/trend split as `HOLD`.
- **An indicator that cannot be computed abstains** rather than raising. Ichimoku
  needs 52 sessions; Anchored VWAP needs non-zero volume, which index tickers
  like `^NSEI` do not report, plus at least `min_segment` bars between its anchor
  and the last bar. A short or volume-less frame degrades conviction instead of
  losing the whole analysis to the exception handler.

  Abstaining correctly needs a *neutral* fallback, not just a non-crashing one.
  `_last` returning a bare `0.0` made two indicators vote on no evidence: RSI 0 is
  maximally oversold, so an unwarmed RSI read Buy, and 0.0 as a Bollinger band put
  price above the upper band, so an unwarmed Bollinger read Sell. RSI now falls
  back to 50.0, and the Bollinger bands are checked for warm-up explicitly —
  a band is a threshold, so no scalar stand-in is neutral with respect to it.

  Anchored VWAP has the mirror-image trap: anchoring on a plain argmax/argmin of
  the lookback put the anchor on the *latest* bar in any sustained trend, making
  the segment one bar long and its VWAP equal to the current price. Neither strict
  comparison could fire, so it abstained in exactly the trends it exists to read.
  `min_segment` keeps the anchor at least 20 bars back, which is also what a
  trader means by an anchor: a swing that has already formed.

Score is 0–10 with 5.0 as "no opinion", so it can never disagree with the label,
and confidence is derived from the net fraction so it does not inflate when the
basket size changes.

- **Use it when** you need an instant, transparent, short-horizon read that a
  human can audit indicator-by-indicator.
- **Watch out for**: it encodes fixed heuristics — it cannot adapt to a regime
  its thresholds weren't designed for. The mean-reversion indicators (RSI,
  Bollinger, Stochastic) and the trend indicators (EMA, ADX, Supertrend,
  Ichimoku) genuinely disagree in a strong trend, and `HOLD` on a 2-2 split is an
  honest report of that rather than a bug.

### 5. PVD Momentum (PDM) — `app/models/pdm_momentum.py`
The house strategy: treats price and volume as functions of time and uses their
**first/second derivatives** (velocity, curvature) plus volume sensitivity and
institutional-participation detection to flag momentum entries.

A now-deleted `ml-service/pdm_strategy_engine.py` variant additionally did
universe scanning, ATR-based stops, and a real historical backtest. None of
that exists in the deployed service — if you want backtesting, it is new work,
recoverable from git history as a starting point.

- **Use it when** you're hunting trend/momentum entries and want volume-confirmed
  signals rather than price alone.
- **Watch out for**: like all momentum systems it whipsaws in sideways markets;
  the confidence score (now continuous, see below) should gate acting on it.

### 6. Ensemble — `app/models/ensemble.py`
Combines Random Forest, Technical, PDM, and LSTM via confidence-weighted
averaging (default static weights `[0.35, 0.25, 0.25, 0.15]` in `main.py`, in that
order).

- **Use it as the default** for general-purpose predictions — averaging
  decorrelated models reduces the variance of any single one.
- **Watch out for**: it is only as good as its members and pays their combined
  latency; if one member silently falls back, the blend quietly degrades.

---

## Walk-forward results (#144)

Every number elsewhere in this file came from one train/test split. This is the
first time each model was checked across many periods, including the ones that
matter (2008, 2020, 2022). Reproduce with:

```bash
cd ml
python backtest.py --models all --folds 10 --horizon 30 --max-origins-per-fold 60
python -m pytest tests/test_backtest.py        # the harness's own guarantees
```

**Method.** For each origin date, every model is called exactly the way
`/predict` serves it: on the trailing 1y window (2y past 180 sessions) and
through its normal `predict`/`analyze`, seeing nothing after the origin
(`test_models_never_see_past_the_origin`). The LSTM and GAN slots are refitted
per fold on windows whose labels resolved before the fold starts, minus a
calendar-day purge. Origins are 30 sessions apart, so realised returns don't
overlap. 9 tickers (the training set: NIFTY, S&P 500, NASDAQ, AAPL, MSFT, NVDA,
RELIANCE, TCS, INFY), 10 contiguous periods from 1934 to 2026, 60 origins per
period (600 total). Skill is `1 − MAE / MAE(no change)`, **not clipped**:
negative means worse than predicting no move.

Measured 2026-10-09, horizon 30 sessions:

| Model | Skill | Periods > 0 | Per-period skill (mean ± sd) | Direction hit-rate |
|---|---|---|---|---|
| Random Forest | −0.264 | 0/10 | −0.248 ± 0.158 | 54.8% |
| Technical | −0.233 | 0/10 | −0.237 ± 0.094 | 53.3% |
| PVD Momentum | −0.008 | 3/10 | −0.006 ± 0.026 | 54.3% |
| LSTM slot | −0.049 | 4/10 | −0.084 ± 0.234 | 59.2% |
| GAN slot | −0.037 | 4/10 | −0.074 ± 0.269 | 59.0% |
| Ensemble, hand-set weights (old) | −0.017 | 5/10 | −0.014 ± 0.047 | 56.0% |
| Ensemble, equal weights (now) | −0.002 | 4/10 | −0.004 ± 0.039 | 57.5% |
| Ensemble, inverse-MAE from past folds | −0.001 | 4/9 | −0.003 ± 0.039 | 57.8% |

Do BUY/SELL calls beat the base rate? Prices rose over 30 sessions at 60.2% of
origins, so a model saying BUY must beat **60.2%**, not 50%:

| Model | #BUY | P(up \| BUY) | #SELL | P(down \| SELL) (base 39.8%) |
|---|---|---|---|---|
| Random Forest | 266 | 65.0% | 178 | 43.8% |
| Technical | 321 | 59.2% | 134 | 39.6% |
| PVD Momentum | 206 | 59.7% | 105 | 41.0% |
| LSTM slot | 283 | 62.5% | 22 | 36.4% |
| GAN slot | 376 | 60.1% | 20 | 35.0% |

**What this says:**

- **No model predicts the size of a 30-session move better than "no change."**
  The LSTM slot's earlier `skill_vs_no_change` of 0.036 was one good split;
  across periods it is −0.08 ± 0.23, positive in 4 of 10.
- **Technical's price target is noise.** It is negative in every period.
  `analyze` projects price from the last 5 days' return; it does not use its
  nine indicator votes for the target at all, and the votes themselves do not
  beat the base rate either.
- **Random Forest's direction is the only signal above the base rate**: BUY is
  right 65.0% vs 60.2%, SELL 43.8% vs 39.8%. With n=266 that is about 1.6
  standard errors, so it is suggestive, not significant. Its magnitude is the worst
  of the five.
- **Ensemble weights (#145):** equal weights beat the hand-set
  `[0.35, 0.25, 0.25, 0.15]` slightly, and inverse-MAE weights learned from
  earlier periods did no better than equal. Production now uses equal weights
  (`ENSEMBLE_WEIGHTS` in `app/models/ensemble.py`).

The harness found two production bugs on its first run. Random Forest returned
an invented +2% for any index with no volume data (`^NSEI` reports zeros), and
crashed on any zero-volume day. Both are fixed, with regression tests.

Not covered yet: other horizons, transaction costs, and the
`agreement_bonus` question in #145 (whether agreeing members deserve extra
confidence). All three are cheap to add to `backtest.py`.

---

## How to choose (decision guide)

Read the walk-forward results above first: none of these beats "no change" on
the size of a move, so choose for what you want to *see*, not for accuracy.

```
Want to audit a read indicator-by-indicator?            → TECHNICAL (ignore its price target)
Want a volume-confirmed momentum read?                  → PVD_MOMENTUM (PDM)
Want the one direction signal above the base rate?      → RANDOM_FOREST (direction, not magnitude)
Want to see where the models disagree?                  → ENSEMBLE (default) and its model spread
```

Two rules of thumb:
1. **No trained artifact ⇒ avoid LSTM/GAN** as your sole model; prefer Random
   Forest, Technical, or PDM, all of which run without offline training.
2. **Sideways market ⇒ down-weight momentum** (PDM) and lean on Technical /
   mean-reversion-friendly Random Forest.

---

## Known limitations & recent fixes

The PDM engine was overhauled in the since-deleted `ml-service/` tree (issue #7).
Recorded here because the same reasoning applies to `app/models/pdm_momentum.py`:

- Removed the hard-coded `[:10]` demo scan cap → full universe is scanned, with
  an optional, explicit `max_scan_candidates` bound (env: `PDM_MAX_SCAN_CANDIDATES`).
- Data is now fetched **once per symbol** and reused for both liquidity
  filtering and signal generation (was downloaded twice), fetched
  **concurrently** via a thread pool.
- **Continuous** confidence scoring replaced the all-or-nothing 0/1 components,
  so signal strength reflects indicator magnitude.
- The backtest now **computes real trade-level P&L** from historical prices
  (win rate, Sharpe-like ratio) instead of returning a hard-coded `42.8%`.
- Added volatility-adjusted **position sizing** (`calculate_position_size`) and
  NaN/division-by-zero handling.

## Contributing a new model

See [`../CONTRIBUTING.md`](../CONTRIBUTING.md#contributing-a-machine-learning-model)
for the full checklist. In short: implement `predict(df, horizon)` (or
`analyze(...)`) returning the standard prediction dict, expose `is_ready()`,
register it in `ml/app/main.py`'s model switch and the `/models` list, keep heavy
training **offline** in `train_models.py`, and add it to the comparison table
above with an honest strengths/weaknesses entry.
