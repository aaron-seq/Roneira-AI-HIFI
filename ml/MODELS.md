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
A generator (also offline-trained) that samples plausible forward price
*trajectories* from a latent vector, giving a distribution you can turn into a
central estimate plus an uncertainty band.

- **Use it when** you care about the *range* of outcomes, not just a single
  number (e.g. scenario / risk framing).
- **Watch out for**: GANs are the hardest to validate; treat outputs as scenario
  generation, not precise forecasts. Artifact-dependent like the LSTM.

### 4. Technical Analysis — `app/models/technical_analysis.py`
Pure rule-based engine: RSI, MACD, Bollinger Bands, Stochastic RSI, ADX, EMA
crossovers, aggregated into a buy/sell/neutral tally. No training, fully
deterministic and explainable.

- **Use it when** you need an instant, transparent, short-horizon read that a
  human can audit indicator-by-indicator.
- **Watch out for**: it encodes fixed heuristics — it cannot adapt to a regime
  its thresholds weren't designed for.

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
averaging (default static weights `[0.3, 0.2, 0.2, 0.3]` in `main.py`).

- **Use it as the default** for general-purpose predictions — averaging
  decorrelated models reduces the variance of any single one.
- **Watch out for**: it is only as good as its members and pays their combined
  latency; if one member silently falls back, the blend quietly degrades.

---

## How to choose (decision guide)

```
Need it explainable and instant, short horizon?        → TECHNICAL
Hunting momentum entries with volume confirmation?      → PVD_MOMENTUM (PDM)
Want a solid CPU-only learned baseline, 1w–3m?          → RANDOM_FOREST
Temporal structure matters and artifact is trained?     → LSTM
Care about a *range* of outcomes / scenarios?           → GAN
Just want the best general-purpose answer?              → ENSEMBLE (default)
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
