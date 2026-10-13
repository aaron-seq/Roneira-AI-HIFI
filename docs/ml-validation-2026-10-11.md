# Indian-equity ML diagnostic — 2026-10-11

The causal alignment and history changes produced **mixed forecast accuracy**.
The 30-session refitted ensemble narrowly beat no change in this small sample;
the seven-session ensemble and most individual forecasts remained worse.
These results support inspecting the validation limits, not a trading-edge claim.

## Fixed comparison

- Before: commit `69ffd6696dfee6fc4cd51e4152ea5dba22c2b290`.
- After: the companion change introducing `origin-inclusive-v2`, intrinsic artifact
  horizon binding, exact label availability and shared serving history.
- Four preselected stocks: RELIANCE.NS, TCS.NS, INFY.NS and HDFCBANK.NS.
- Yahoo-adjusted daily OHLCV: 2,471 sessions per stock, 2016-10-10 to
  2026-10-09 in Asia/Kolkata. Both implementations used the same cached files.
- Four chronological folds, 12 sampled origins **total per fold across all four
  stocks**, 48 origins per horizon. Sampling seed 42; origins are one horizon
  apart per stock before sampling. Both phases use the same dates and labels.
- At least 1,500 preceding sessions before evaluation; the earliest evaluated
  origin is 2022-11-04 in Asia/Kolkata. Evaluation does not test the 2008 or
  2020 regimes, even though some earlier prices are available for training.
- Before serving budget: 252 sessions. After: 504 sessions at both 7 and 30.
- The sequence slots are fitted for the evaluated horizon before each fold.
  This evaluates training recipes without future data, rather than retrospectively
  scoring a bundled model trained after an evaluation date.

**Seven-session serving caveat:** bundled sequence artifacts target 30 sessions.
A live seven-session request excludes the LSTM slot. The fixed RF + rules blend
below matches its three eligible members when they are available. The four-member
refitted blend uses a research seven-session artifact and is not the shipped
30-session bundle. At 30 sessions the four-member selection matches production,
with fold-specific historical refits rather than the shipped artifact.

## Results

MAE is in percentage points of forward return. Skill is
`1 - MAE / MAE(no change)`; negative values mean worse than no change.
Each row below scores the same 48 origins. All five after-phase model slots
covered 48/48 origins with no fallback, and the four-member refitted ensemble
had no excluded members. The baseline harness did not record fallback flags.

### 7 trading sessions

No-change MAE: **2.79 percentage points**.

| Model | MAE before → after | Skill before → after | After folds beating no change |
|---|---:|---:|---:|
| Random Forest | 3.16 → 3.35 | -0.132 → -0.201 | 0/4 |
| Technical | 2.99 → 2.99 | -0.071 → -0.071 | 2/4 |
| PVD Momentum | 2.78 → 2.78 | +0.004 → +0.004 | 2/4 |
| Sequence slot (LSTM) | 3.11 → 3.08 | -0.114 → -0.102 | 1/4 |
| Sequence slot (GAN) | 3.18 → 3.12 | -0.140 → -0.117 | 0/4 |
| RF + rules, fixed equal blend | 2.79 → 2.87 | +0.001 → -0.029 | 2/4 |
| Four-member, horizon-matched refitted blend | 2.85 → 2.87 | -0.020 → -0.027 | 2/4 |

### 30 trading sessions

No-change MAE: **6.46 percentage points**.

| Model | MAE before → after | Skill before → after | After folds beating no change |
|---|---:|---:|---:|
| Random Forest | 9.10 → 7.29 | -0.410 → -0.130 | 0/4 |
| Technical | 7.32 → 7.32 | -0.134 → -0.134 | 1/4 |
| PVD Momentum | 6.68 → 6.68 | -0.035 → -0.035 | 0/4 |
| Sequence slot (LSTM) | 6.79 → 6.85 | -0.052 → -0.061 | 1/4 |
| Sequence slot (GAN) | 7.14 → 7.02 | -0.106 → -0.087 | 0/4 |
| RF + rules, fixed equal blend | 6.93 → 6.58 | -0.073 → -0.019 | 2/4 |
| Four-member, horizon-matched refitted blend | 6.73 → 6.41 | -0.043 → +0.007 | 2/4 |

The history expansion reduced the 30-session Random Forest error while
increasing its seven-session error. Sequence-slot changes were also mixed.
Technical and PVD Momentum were unchanged to reporting precision.
The new 30-session four-member blend improved MAE by less than 1% relative
to no change; four folds and 48 correlated outcomes do not establish a stable
advantage. No model parameters or ensemble weights were tuned to this sample.

Inverse-MAE weights are included in the machine-readable results. They omit
the first fold, scoring 36 origins, so their pooled MAE and baseline are not
directly comparable with the 48-origin rows above. Their weights use only
complete earlier-fold labels resolved before the next scored fold.

## Reproduction and evidence

The [JSON result](ml-validation-2026-10-11.json) contains full fold metrics,
coverage, signal base rates, software versions, input hashes and run settings.
Raw cache and per-origin CSV files were saved in the execution workspace under
`/workspace/.setup/ml-design-review/`. The comparison checked exact fold, ticker,
origin and label timestamps, identical input file hashes, and equal realised
returns within CSV floating-point precision (absolute tolerance `1e-12`).
After the final Random Forest guard against stale feature rows was added, all
96 Random Forest forecasts were repeated. Each origin had valid current-session
features; predictions and availability matched the recorded after results.

Run the after protocol from `ml/`:

```bash
python backtest.py --models all --tickers RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS \
  --period 10y --folds 4 --horizon 7 --max-origins-per-fold 12 \
  --json results-7.json --records origins-7.csv
python backtest.py --models all --tickers RELIANCE.NS,TCS.NS,INFY.NS,HDFCBANK.NS \
  --period 10y --folds 4 --horizon 30 --max-origins-per-fold 12 \
  --json results-30.json --records origins-30.csv
```

The command fetches a rolling ten-year window if its cache is absent. A later
download can include different sessions or revised adjusted prices; compare
input hashes before treating it as a repeat of this measurement. The baseline
used the same fixed origins from its isolated source snapshot and the shared
historical cache; the custom driver supplied `min_history=1500` to both phases.

These are forecast diagnostics for four surviving large liquid stocks after
late 2022. Cross-stock returns are correlated. There are no fees, slippage,
liquidity constraints, position sizing, execution or portfolio P&L. Wider
unseen instruments and periods, a prospective artifact holdout and strategy
costs remain unvalidated. Issues #144 and #145 cover the wider evaluation work.
