"""
Gradient-boosted backend for the sequence-model slots.

Why this exists: the LSTM and GAN slots require TensorFlow, which is not a
declared dependency (see ml/requirements.txt). Without it both slots fell
through to a hand-written heuristic -- `_fallback_predict` -- so two of the six
advertised models were not trained on anything, and the Ensemble still weighted
the LSTM slot at 0.3.

xgboost and scikit-learn are already installed, train in seconds on CPU, and
produce a genuine fitted model. This module wraps one in an adapter that speaks
the small slice of the Keras API the existing inference code uses:

    model.predict(x, verbose=0)[0][0]

so `lstm.py` and `gan.py` keep their feature engineering, signal thresholds, and
artifact-loading structure unchanged. The GAN slot additionally calls
`predict([noise, sequence], verbose=0)`; the adapter accepts that shape too.

ponytail: point estimate only. The GAN slot samples 5 times expecting a spread,
which is now degenerate (std 0), so its confidence comes from validation error
rather than sample dispersion. Upgrade path if the spread matters: fit quantile
regressors (sklearn GradientBoostingRegressor(loss="quantile")) at p10/p50/p90
and interpolate per draw.
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

logger = logging.getLogger("roneira-ml.gradient_boost")

try:
    import joblib
except ImportError:  # pragma: no cover - joblib ships with scikit-learn
    joblib = None

try:
    from xgboost import XGBRegressor

    XGBOOST_AVAILABLE = True
except ImportError:  # pragma: no cover
    XGBRegressor = None
    XGBOOST_AVAILABLE = False


def _flatten(inputs) -> np.ndarray:
    """
    Normalise the Keras-style call shapes into a 2-D design matrix.

    LSTM passes a single (1, seq_len, n_features) window. GAN passes
    [noise, window]; the noise drove the generator's stochasticity and carries
    no information for a tree model, so the window is taken and the noise
    dropped.
    """
    if isinstance(inputs, (list, tuple)):
        # Last element is the real feature window for the GAN call shape.
        inputs = inputs[-1]

    array = np.asarray(inputs, dtype=float)
    if array.ndim == 1:
        array = array.reshape(1, -1)
    return array.reshape(array.shape[0], -1)


class GradientBoostArtifact:
    """A fitted gradient-boosted regressor exposing a minimal Keras surface."""

    def __init__(self, estimator, n_features: int):
        self._estimator = estimator
        self.n_features = n_features

    def predict(self, inputs, verbose: int = 0):  # noqa: ARG002 - Keras parity
        matrix = _flatten(inputs)

        # A window shorter/longer than training (different seq_len or feature
        # count) would silently produce nonsense, so pad/truncate explicitly.
        if matrix.shape[1] != self.n_features:
            fitted = np.zeros((matrix.shape[0], self.n_features), dtype=float)
            width = min(matrix.shape[1], self.n_features)
            fitted[:, :width] = matrix[:, :width]
            matrix = fitted

        predictions = np.asarray(self._estimator.predict(matrix), dtype=float)
        return predictions.reshape(-1, 1)


def build_estimator(n_estimators: int = 300, max_depth: int = 4):
    """Regressor used for the sequence slots. Falls back to sklearn if needed."""
    if XGBOOST_AVAILABLE:
        return XGBRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_lambda=1.0,
            random_state=42,
            n_jobs=-1,
            objective="reg:squarederror",
            # Histogram splits instead of the default exact scan. On the real
            # training set (92k windows x 660 columns) exact took 502s for the
            # LSTM slot; hist reaches the same validation error in a fraction of
            # that, which is what makes `npm run train:ml` re-runnable.
            tree_method="hist",
        )

    from sklearn.ensemble import GradientBoostingRegressor

    return GradientBoostingRegressor(
        n_estimators=n_estimators,
        max_depth=max_depth,
        learning_rate=0.05,
        random_state=42,
    )


def _to_utc_naive(stamps) -> np.ndarray:
    """
    Normalise timestamps to tz-naive UTC datetime64.

    yfinance returns a tz-aware index, and the default tickers span NSE and
    NASDAQ, so the pool mixes offsets. Casting straight to datetime64[ns] warns
    ("no explicit representation of timezones available") and silently keeps the
    local wall-clock reading, which would interleave two exchanges' sessions by
    up to ten hours when sorting. Converting to UTC first makes the ordering and
    the purge cutoff mean the same thing for every ticker.
    """
    return pd.to_datetime(stamps, utc=True).tz_localize(None).to_numpy(
        dtype="datetime64[ns]"
    )


MIN_TRAIN_ROWS = 500


def fit_windows(
    windows: np.ndarray,
    targets: np.ndarray,
    n_estimators: int = 300,
    max_depth: int = 4,
    stamps: np.ndarray | None = None,
    purge_days: int = 0,
) -> tuple[GradientBoostArtifact, dict]:
    """
    Fit on 3-D sequence windows, returning the artifact and validation metrics.

    The split is chronological (no shuffling): these are overlapping time
    windows, so a random split would leak future information into training and
    report an optimistic error. `build_training_windows` sorts its output by
    date for exactly this reason -- appending frame-by-frame made the last 20%
    of rows *a different set of tickers* rather than a later period, so this
    split measured cross-instrument transfer while reporting it as a time split.

    `purge_days` removes training windows whose forward label resolves inside
    the validation period. It is measured in **calendar days against `stamps`**,
    not in rows. Counting rows was wrong once the pool was date-sorted: nine
    tickers contribute a window for the same date, so a 30-row purge spanned two
    trading sessions (measured: 2018-04-09 to 2018-04-12) while the label needed
    thirty. Roughly 28 of the 30 sessions of overlap stayed in training and the
    reported skill was optimistic.

    Pass calendar days, generously: sessions-to-calendar is about 7/5 and market
    holidays only widen it, so over-purging by a few days costs a little training
    data and under-purging silently inflates the score.
    """
    X = windows.reshape(windows.shape[0], -1)
    y = np.asarray(targets, dtype=float).reshape(-1)

    if len(X) < 40:
        raise ValueError("Not enough training windows for the gradient-boosted model.")

    split = int(len(X) * 0.8)
    train_end = split
    if stamps is not None and purge_days > 0:
        stamp_array = _to_utc_naive(stamps)
        if len(stamp_array) != len(X):
            raise ValueError("stamps must line up 1:1 with the training windows.")
        cutoff = stamp_array[split] - np.timedelta64(int(purge_days), "D")
        train_end = int(np.searchsorted(stamp_array[:split], cutoff, side="left"))

    # Raise rather than clamp. `max(1, ...)` meant a dataset barely past the
    # 40-window guard trained on a couple of rows and still wrote an artifact,
    # with a confidence derived from a handful of validation rows.
    if train_end < MIN_TRAIN_ROWS:
        raise ValueError(
            f"Purging {purge_days} days leaves {train_end} training rows "
            f"(minimum {MIN_TRAIN_ROWS}). Supply more history."
        )

    X_train, X_test = X[:train_end], X[split:]
    y_train, y_test = y[:train_end], y[split:]

    estimator = build_estimator(n_estimators=n_estimators, max_depth=max_depth)
    estimator.fit(X_train, y_train)

    predictions = np.asarray(estimator.predict(X_test), dtype=float)
    mae = float(np.mean(np.abs(predictions - y_test)))
    rmse = float(np.sqrt(np.mean((predictions - y_test) ** 2)))

    # Baseline = predicting "no change". If the model cannot beat that, its
    # confidence should reflect it rather than reporting a flattering number.
    baseline_mae = float(np.mean(np.abs(y_test)))
    skill = 0.0 if baseline_mae == 0 else max(0.0, 1.0 - (mae / baseline_mae))

    metrics = {
        "validation_mae": mae,
        "validation_rmse": rmse,
        "baseline_mae": baseline_mae,
        "skill_vs_no_change": skill,
        "confidence": float(max(35.0, min(85.0, 40.0 + skill * 50.0))),
        "training_windows": int(len(X)),
        "train_rows": int(len(X_train)),
        "purge_days": int(purge_days),
        "purged_rows": int(split - train_end),
        "n_features": int(X.shape[1]),
        "backend": "xgboost" if XGBOOST_AVAILABLE else "sklearn",
    }

    return GradientBoostArtifact(estimator, n_features=X.shape[1]), metrics


def build_training_windows(
    datasets,
    prepare,
    sequence_length: int,
    horizon_days: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Turn raw OHLCV frames into (windows, forward-return targets).

    `prepare` is the owning model's own feature function, so each slot keeps the
    feature set it was designed around rather than sharing one generic set.
    Targets stop `horizon_days` before the end of each frame -- beyond that the
    realised forward return does not exist yet and would be fabricated.

    Returns (windows, targets, stamps), all sorted by window end date across all
    frames. Appending frame after frame instead made row order mean "which
    ticker", so the 80/20 split in `fit_windows` held out the last tickers rather
    than the last years. The stamps go back out because `fit_windows` needs real
    dates to purge by -- row counts do not survive pooling (see its docstring).
    """
    stamps: list = []
    windows: list[np.ndarray] = []
    targets: list[float] = []

    for frame in datasets:
        if len(frame) < sequence_length + horizon_days + 30:
            continue

        features = prepare(frame)
        features = np.nan_to_num(
            np.asarray(features, dtype=float), nan=0.0, posinf=0.0, neginf=0.0
        )
        close = np.asarray(frame["Close"].values, dtype=float)

        for idx in range(sequence_length, len(close) - horizon_days):
            start, future = close[idx], close[idx + horizon_days]

            # Skip rather than impute: a non-finite price means the label would
            # be invented. Boosters reject NaN labels outright, and silently
            # zero-filling them would teach the model that gaps mean "no move".
            if not np.isfinite(start) or not np.isfinite(future) or start <= 0:
                continue

            window = features[idx - sequence_length : idx]
            if not np.isfinite(window).all():
                continue

            stamps.append(frame.index[idx])
            windows.append(window)
            targets.append((future - start) / start)

    if not windows:
        raise ValueError("No training windows could be built from the supplied data.")

    stamp_array = _to_utc_naive(stamps)
    order = np.argsort(stamp_array, kind="stable")
    return (
        np.asarray(windows, dtype=float)[order],
        np.asarray(targets, dtype=float)[order],
        stamp_array[order],
    )


def save_artifact(artifact: GradientBoostArtifact, path: Path) -> Path:
    if joblib is None:
        raise RuntimeError("joblib is required to persist gradient-boosted artifacts.")
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, path)
    return path


def load_artifact(path: Path) -> GradientBoostArtifact | None:
    """
    Load a locally-produced artifact.

    Security note: joblib uses pickle, so this must only ever read files this
    service produced itself via `train_models.py` (or ones shipped in the repo)
    -- never a user upload or a remote fetch. The path is not user-controlled at
    request time: it comes from ML_MODEL_DIR / the bundled artifacts directory,
    both of which are deploy-time configuration. Anyone able to write there can
    already run code in this process, so pickle adds no new exposure. Do not
    extend this to accept a client-supplied path.
    """
    if joblib is None or not path.exists():
        return None
    try:
        return joblib.load(path)
    except Exception as exc:
        logger.error("Failed to load gradient-boosted artifact %s: %s", path, exc)
        return None
