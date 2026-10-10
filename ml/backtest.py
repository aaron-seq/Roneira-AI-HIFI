"""
Walk-forward evaluation: do the models' predictions carry information?

Not a trading simulator -- no costs, sizing or Sharpe (see #144 for why that
is out of scope). For every model the question is the same: at an origin
date t, using only data up to t, what forward return did the model predict,
and how does that compare with what happened h sessions later, and with the
trivial "no change" forecast?

Each model is called exactly the way /predict serves it: on a trailing window
the length of the fetch app/main.py does (1y, or 2y for horizons over 180),
through its normal predict/analyze method. The two trained slots (LSTM, GAN)
are refitted per fold on windows whose labels resolve before the fold starts,
then served through the same adapter production loads from disk.

    cd ml && python backtest.py --models TECHNICAL,PVD_MOMENTUM --folds 10
    cd ml && python backtest.py --models all --horizon 30 --json results.json

Skill is reported unclipped: negative means worse than predicting no change.
"""
from __future__ import annotations

import argparse
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from app.models.ensemble import ENSEMBLE_MEMBERS, ENSEMBLE_WEIGHTS
from app.models.gan import GANPredictor
from app.models.gradient_boost import (
    GradientBoostArtifact,
    build_estimator,
    build_training_windows,
)
from app.models.lstm import LSTMPredictor
from app.models.pdm_momentum import PVDMomentumEngine
from app.models.random_forest import RandomForestPredictor
from app.models.technical_analysis import TechnicalAnalyzer

logger = logging.getLogger("roneira-ml.backtest")

CACHE_DIR = Path(__file__).parent / ".cache" / "backtest"
MEMBERS = ["RANDOM_FOREST", "TECHNICAL", "PVD_MOMENTUM", "LSTM", "GAN"]


def serving_lookback(horizon: int) -> int:
    """Sessions of history /predict hands a model: main.py fetches 2y past 180."""
    return 504 if horizon > 180 else 252


def score(predicted: np.ndarray, realised: np.ndarray) -> dict:
    """MAE, the no-change baseline, unclipped skill, and directional hit rate."""
    predicted = np.asarray(predicted, dtype=float)
    realised = np.asarray(realised, dtype=float)
    n = len(realised)
    if n == 0:
        return {"n": 0, "mae": np.nan, "baseline_mae": np.nan, "skill": np.nan, "hit_rate": np.nan}
    mae = float(np.mean(np.abs(predicted - realised)))
    baseline = float(np.mean(np.abs(realised)))
    # Hit rate only over calls that took a side: a prediction of exactly 0 is
    # "no change", which has no direction to be right or wrong about.
    sided = predicted != 0
    hits = np.sign(predicted[sided]) == np.sign(realised[sided])
    return {
        "n": n,
        "mae": mae,
        "baseline_mae": baseline,
        "skill": float(1.0 - mae / baseline) if baseline > 0 else np.nan,
        "hit_rate": float(hits.mean()) if sided.any() else np.nan,
    }


@dataclass
class Fold:
    index: int
    start: pd.Timestamp
    end: pd.Timestamp
    # (ticker, origin position) pairs falling inside [start, end).
    origins: list[tuple[str, int]] = field(default_factory=list)


def make_folds(
    frames: dict[str, pd.DataFrame],
    n_folds: int,
    horizon: int,
    stride: int,
    min_history: int,
) -> list[Fold]:
    """
    Split origin dates into `n_folds` contiguous calendar periods.

    Folds are defined by date across all tickers, so fold 3 means "the same
    stretch of market history" for every ticker -- a regime -- rather than
    "rows 300-400 of each frame", which would be a different period per ticker.
    Origins are every `stride` sessions; stride == horizon makes the realised
    returns non-overlapping, so per-fold numbers are not inflated by counting
    the same move several times.
    """
    candidates: list[tuple[pd.Timestamp, str, int]] = []
    for ticker, frame in frames.items():
        for pos in range(min_history, len(frame) - horizon, stride):
            candidates.append((frame.index[pos], ticker, pos))
    if not candidates:
        raise ValueError("No origins: frames are shorter than min_history + horizon.")

    candidates.sort(key=lambda item: item[0])
    stamps = pd.DatetimeIndex([c[0] for c in candidates])
    edges = stamps[np.linspace(0, len(stamps) - 1, n_folds + 1).astype(int)]

    folds = [Fold(i, edges[i], edges[i + 1]) for i in range(n_folds)]
    for stamp, ticker, pos in candidates:
        # searchsorted on the left edges; the last edge is inclusive.
        i = min(int(edges.searchsorted(stamp, side="right")) - 1, n_folds - 1)
        folds[i].origins.append((ticker, pos))
    return [fold for fold in folds if fold.origins]


def signal_direction(result: dict) -> int:
    """+1 for BUY/STRONG_BUY, -1 for SELL/STRONG_SELL, 0 for HOLD or missing."""
    label = str((result.get("short_term_signal") or {}).get("signal", "HOLD"))
    return 1 if label.endswith("BUY") else (-1 if label.endswith("SELL") else 0)


def signal_precision(direction: np.ndarray, realised: np.ndarray) -> dict:
    """
    When the model says BUY, how often does price rise -- against how often it
    rises anyway. Without the base rate a BUY hit rate is meaningless: in a
    rising market "always BUY" is right more often than not.
    """
    direction = np.asarray(direction)
    realised = np.asarray(realised, dtype=float)
    buys, sells = direction > 0, direction < 0
    return {
        "base_up": float(np.mean(realised > 0)) if len(realised) else np.nan,
        "n_buy": int(buys.sum()),
        "p_up_given_buy": float(np.mean(realised[buys] > 0)) if buys.any() else np.nan,
        "n_sell": int(sells.sum()),
        "p_down_given_sell": float(np.mean(realised[sells] < 0)) if sells.any() else np.nan,
    }


def predicted_return(result: dict, current: float) -> float:
    price = float(result.get("predicted_price", current))
    return price / current - 1.0 if current > 0 else 0.0


class Backtester:
    def __init__(self, frames: dict[str, pd.DataFrame], horizon: int, purge_days: int | None = None):
        self.frames = frames
        self.horizon = horizon
        self.lookback = serving_lookback(horizon)
        # Calendar days, generous: the same rule train_gradient_boost uses.
        self.purge_days = purge_days if purge_days is not None else horizon * 7 // 5 + 5
        self.rf = RandomForestPredictor()
        self.ta = TechnicalAnalyzer()
        self.pdm = PVDMomentumEngine()
        self.lstm = LSTMPredictor()
        self.gan = GANPredictor()

    def _fit_slot(self, prepare, sequence_length: int, cutoff: pd.Timestamp) -> GradientBoostArtifact:
        """Fit a sequence slot on every window whose label resolved before `cutoff`."""
        windows, targets, stamps = build_training_windows(
            list(self.frames.values()), prepare, sequence_length, self.horizon
        )
        # A window stamped at t has its label at t + horizon sessions; the
        # purge keeps any label that resolves inside the fold out of training.
        limit = np.datetime64(cutoff.tz_localize(None)) - np.timedelta64(self.purge_days, "D")
        keep = stamps < limit
        if keep.sum() < 500:
            raise ValueError(f"only {int(keep.sum())} training windows before {cutoff.date()}")
        X = windows[keep].reshape(int(keep.sum()), -1)
        estimator = build_estimator()
        estimator.fit(X, targets[keep])
        return GradientBoostArtifact(estimator, n_features=X.shape[1])

    def _predict_all(self, frame: pd.DataFrame, ticker: str, pos: int, models: list[str]) -> dict[str, float]:
        window = frame.iloc[max(0, pos + 1 - self.lookback) : pos + 1]
        current = float(window["Close"].iloc[-1])
        out: dict[str, float] = {}
        for name in models:
            if name == "RANDOM_FOREST":
                result = self.rf.predict(window, self.horizon)
            elif name == "TECHNICAL":
                result = self.ta.analyze(window, self.horizon)
            elif name == "PVD_MOMENTUM":
                result = self.pdm.analyze(window, ticker, self.horizon)
            elif name == "LSTM":
                result = self.lstm.predict(window, self.horizon)
            elif name == "GAN":
                result = self.gan.predict(window, self.horizon)
            else:
                raise ValueError(name)
            out[name] = predicted_return(result, current)
            out[f"{name}:signal"] = signal_direction(result)
        return out

    def run(self, folds: list[Fold], models: list[str]) -> list[dict]:
        """One record per (fold, ticker, origin) with every model's prediction."""
        records: list[dict] = []
        for fold in folds:
            started = time.time()
            if "LSTM" in models:
                self.lstm._model = self._fit_slot(self.lstm._prepare_features, self.lstm.sequence_length, fold.start)
                self.lstm._metadata = {"confidence": 50.0}
            if "GAN" in models:
                self.gan._generator = self._fit_slot(self.gan._prepare_data, self.gan.sequence_length, fold.start)
                self.gan._metadata = {"confidence": 50.0}

            for ticker, pos in fold.origins:
                frame = self.frames[ticker]
                current = float(frame["Close"].iloc[pos])
                future = float(frame["Close"].iloc[pos + self.horizon])
                record = {
                    "fold": fold.index,
                    "ticker": ticker,
                    "date": str(frame.index[pos].date()),
                    "realised": future / current - 1.0,
                }
                record.update(self._predict_all(frame, ticker, pos, models))
                records.append(record)
            logger.info(
                "fold %d (%s .. %s): %d origins in %.1fs",
                fold.index, fold.start.date(), fold.end.date(), len(fold.origins), time.time() - started,
            )
        return records


def ensemble_variants(records: pd.DataFrame) -> pd.DataFrame:
    """
    Recombine the recorded member predictions under alternative weightings (#145).

    Done offline from the same per-origin member predictions, so every variant
    is scored on identical origins. Inverse-MAE weights are computed from the
    *preceding* folds only, so they never see the fold they are scored on.
    """
    members = [m for m in ENSEMBLE_MEMBERS if m in records.columns]
    if len(members) < 2:
        return records
    out = records.copy()
    matrix = out[members].to_numpy()
    if members == list(ENSEMBLE_MEMBERS):
        out["ENSEMBLE_PRODUCTION"] = matrix @ np.asarray(ENSEMBLE_WEIGHTS)
    out["ENSEMBLE_EQUAL"] = matrix.mean(axis=1)

    inverse = np.full(len(out), np.nan)
    for fold in sorted(out["fold"].unique()):
        past = out[out["fold"] < fold]
        if past.empty:
            continue
        mae = np.array([np.mean(np.abs(past[m] - past["realised"])) for m in members])
        # Floored so a member that was exactly right takes ~all the weight
        # instead of producing 1/0 and NaN weights.
        inv = 1 / np.maximum(mae, 1e-12)
        weights = inv / inv.sum()
        mask = (out["fold"] == fold).to_numpy()
        inverse[mask] = matrix[mask] @ weights
    out["ENSEMBLE_INVERSE_MAE"] = inverse
    return out


def summarise(records: pd.DataFrame, columns: list[str]) -> dict:
    summary: dict[str, dict] = {}
    for name in columns:
        valid = records[records[name].notna()]
        per_fold = [
            {"fold": int(f), "start": group["date"].min(), "end": group["date"].max(), **score(group[name], group["realised"])}
            for f, group in valid.groupby("fold")
        ]
        skills = np.array([row["skill"] for row in per_fold], dtype=float)
        summary[name] = {
            "pooled": score(valid[name], valid["realised"]),
            "fold_skill_mean": float(np.nanmean(skills)) if len(skills) else np.nan,
            "fold_skill_std": float(np.nanstd(skills)) if len(skills) else np.nan,
            "folds_beating_baseline": int(np.sum(skills > 0)),
            "folds": per_fold,
        }
        if f"{name}:signal" in valid:
            summary[name]["signals"] = signal_precision(valid[f"{name}:signal"], valid["realised"])
    return summary


def print_report(summary: dict, horizon: int) -> None:
    print(f"\nWalk-forward, horizon {horizon} sessions. Skill = 1 - MAE / MAE(no change); <0 is worse than no change.\n")
    header = f"{'model':<22}{'n':>6}{'MAE':>9}{'base':>9}{'skill':>9}{'fold mean±std':>18}{'beat':>7}{'hit%':>7}"
    print(header)
    print("-" * len(header))
    for name, s in summary.items():
        p = s["pooled"]
        folds = len(s["folds"])
        print(
            f"{name:<22}{p['n']:>6}{p['mae']:>9.4f}{p['baseline_mae']:>9.4f}{p['skill']:>9.3f}"
            f"{s['fold_skill_mean']:>10.3f} ±{s['fold_skill_std']:>6.3f}"
            f"{s['folds_beating_baseline']:>4}/{folds:<2}{p['hit_rate'] * 100:>7.1f}"
        )
    print()
    with_signals = {name: s["signals"] for name, s in summary.items() if "signals" in s}
    if with_signals:
        print("Signals: does BUY/SELL beat the base rate of up/down moves?\n")
        header = f"{'model':<22}{'P(up)':>8}{'#BUY':>7}{'P(up|BUY)':>11}{'P(down)':>9}{'#SELL':>7}{'P(dn|SELL)':>12}"
        print(header)
        print("-" * len(header))
        for name, sig in with_signals.items():
            print(
                f"{name:<22}{sig['base_up'] * 100:>7.1f}%{sig['n_buy']:>7}{sig['p_up_given_buy'] * 100:>10.1f}%"
                f"{(1 - sig['base_up']) * 100:>8.1f}%{sig['n_sell']:>7}{sig['p_down_given_sell'] * 100:>11.1f}%"
            )
        print()
    for name, s in summary.items():
        print(f"{name} per fold:")
        for row in s["folds"]:
            print(
                f"  {row['fold']:>2}  {row['start']} .. {row['end']}  n={row['n']:<4} "
                f"skill={row['skill']:>7.3f}  hit={row['hit_rate'] * 100:5.1f}%"
            )
    print()


def load_frames(tickers: list[str], period: str, refresh: bool) -> dict[str, pd.DataFrame]:
    """Fetch full history once and cache it: a backtest should not re-download per run."""
    import yfinance as yf

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    frames: dict[str, pd.DataFrame] = {}
    for ticker in tickers:
        # CSV, not pickle: this is plain OHLCV, and a cache file should never be
        # able to execute code when read back.
        path = CACHE_DIR / f"{ticker.replace('^', '_')}_{period}.csv"
        if path.exists() and not refresh:
            frame = pd.read_csv(path, index_col=0)
            frame.index = pd.to_datetime(frame.index, utc=True)
        else:
            frame = yf.Ticker(ticker).history(period=period)
            if not frame.empty:
                frame = frame.dropna(subset=["Open", "High", "Low", "Close"])
            frame.to_csv(path)
        # One timezone for every frame: NSE and NASDAQ indexes carry different
        # offsets, and pooling them would make fold edges an object index.
        frame.index = pd.to_datetime(frame.index, utc=True)
        if len(frame) < 600:
            logger.warning("Skipping %s: only %d sessions", ticker, len(frame))
            continue
        frames[ticker] = frame
    return frames


def main() -> None:
    from train_models import DEFAULT_TICKERS

    parser = argparse.ArgumentParser(description="Walk-forward evaluation of the prediction models.")
    parser.add_argument("--models", default="TECHNICAL,PVD_MOMENTUM", help=f"comma list from {MEMBERS}, or 'all'")
    parser.add_argument("--tickers", default=",".join(DEFAULT_TICKERS))
    parser.add_argument("--period", default="max")
    parser.add_argument("--horizon", type=int, default=30, help="sessions ahead, as /predict uses horizon_days")
    parser.add_argument("--folds", type=int, default=10)
    parser.add_argument("--stride", type=int, default=None, help="sessions between origins (default: horizon)")
    parser.add_argument("--max-origins-per-fold", type=int, default=None, help="subsample for slow models")
    parser.add_argument("--json", type=Path, default=None, help="write the full summary here")
    parser.add_argument("--refresh", action="store_true", help="re-download instead of using the cache")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    models = MEMBERS if args.models == "all" else [m.strip().upper() for m in args.models.split(",")]
    unknown = set(models) - set(MEMBERS)
    if unknown:
        raise SystemExit(f"unknown models: {sorted(unknown)}")

    frames = load_frames([t.strip() for t in args.tickers.split(",") if t.strip()], args.period, args.refresh)
    if not frames:
        raise SystemExit("No usable frames.")

    tester = Backtester(frames, args.horizon)
    # Trained slots need several years before the first fold to fit on.
    min_history = max(tester.lookback, 1500 if {"LSTM", "GAN"} & set(models) else 0)
    folds = make_folds(frames, args.folds, args.horizon, args.stride or args.horizon, min_history)
    if args.max_origins_per_fold:
        rng = np.random.default_rng(42)
        for fold in folds:
            if len(fold.origins) > args.max_origins_per_fold:
                picks = rng.choice(len(fold.origins), args.max_origins_per_fold, replace=False)
                fold.origins = [fold.origins[i] for i in sorted(picks)]

    records = pd.DataFrame(tester.run(folds, models))
    records = ensemble_variants(records)
    columns = [c for c in records.columns if c in MEMBERS or c.startswith("ENSEMBLE_")]
    summary = summarise(records, columns)
    print_report(summary, args.horizon)

    if args.json:
        args.json.write_text(
            json.dumps(
                {"horizon": args.horizon, "tickers": list(frames), "models": models, "summary": summary},
                indent=2,
                default=lambda v: None if isinstance(v, float) and np.isnan(v) else str(v),
            )
        )


if __name__ == "__main__":
    main()
