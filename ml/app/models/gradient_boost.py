"""
Gradient-boosted backend for the sequence-model slots.

The historical LSTM and GAN slots use fitted CPU regressors. Their public model
identifiers remain compatible with saved requests; their runtime backend is
reported separately. This adapter provides the existing sequence call shape:

    model.predict(x, verbose=0)[0][0]

The adapter also accepts the legacy `predict([noise, sequence], verbose=0)`
shape, discarding noise because this is a deterministic point estimate.

This is a point estimate only, so the GAN slot reports no spread and takes its
heuristic score from validation error (#143). Upgrade path if an interval is ever
surfaced in the UI: fit quantile regressors (sklearn
GradientBoostingRegressor(loss="quantile")) at p10/p50/p90.
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

logger = logging.getLogger("roneira-ml.gradient_boost")
WINDOW_CONTRACT = "origin-inclusive-v2"

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
    if array.ndim not in (1, 2, 3):
        raise ValueError("Prediction input must be a feature matrix or sequence batch.")
    if array.ndim == 1:
        array = array.reshape(1, -1)
    return array.reshape(array.shape[0], -1)


class GradientBoostArtifact:
    """A fitted gradient-boosted regressor exposing a minimal Keras surface."""

    def __init__(self, estimator, n_features: int, window_shape: tuple[int, int] | None = None, trained_horizon_sessions: int | None = None):
        self._estimator = estimator
        self.n_features = n_features
        self.window_shape = window_shape
        self.trained_horizon_sessions = trained_horizon_sessions
        self.window_contract = WINDOW_CONTRACT

    @property
    def backend(self) -> str:
        module = type(getattr(self, "_estimator", None)).__module__
        if module.startswith("xgboost"):
            return "xgboost"
        if module.startswith("sklearn"):
            return "sklearn"
        return "unknown"

    def predict(self, inputs, verbose: int = 0):  # noqa: ARG002 - Keras parity
        sequence = inputs[-1] if isinstance(inputs, (list, tuple)) else inputs
        array = np.asarray(sequence, dtype=float)
        fitted_shape = getattr(self, "window_shape", None)
        if array.ndim == 3 and fitted_shape is not None and array.shape[1:] != fitted_shape:
            raise ValueError("Prediction sequence shape does not match the fitted window.")
        matrix = _flatten(inputs)
        if matrix.shape[1] != self.n_features:
            raise ValueError("Prediction feature count does not match the fitted model.")
        if len(matrix) == 0 or not np.isfinite(matrix).all():
            raise ValueError("Prediction features must be finite and nonempty.")

        predictions = np.asarray(self._estimator.predict(matrix), dtype=float)
        if predictions.size != len(matrix) or not np.isfinite(predictions).all():
            raise ValueError("Estimator returned invalid predictions.")
        return predictions.reshape(-1, 1)


def artifact_backend(artifact) -> str | None:
    if artifact is None:
        return None
    if isinstance(artifact, GradientBoostArtifact):
        return artifact.backend
    module = type(artifact).__module__
    return "tensorflow" if module.startswith(("tensorflow", "keras")) else "unknown"


def trained_horizon(metadata: dict) -> int | None:
    if not isinstance(metadata, dict):
        return None
    value = metadata.get("horizon_days")
    return value if isinstance(value, int) and not isinstance(value, bool) and value > 0 else None


def artifact_contract_reason(artifact, metadata: dict, sequence_length: int, n_features: int, horizon: int) -> str | None:
    """Fail closed when a bundle does not describe the requested fitted task."""
    if artifact is None:
        return "artifact_unavailable"
    if (
        not isinstance(artifact, GradientBoostArtifact)
        or not isinstance(metadata, dict)
        or metadata.get("research_only") is True
        or metadata.get("window_contract") != WINDOW_CONTRACT
        or getattr(artifact, "window_contract", None) != WINDOW_CONTRACT
        or artifact.backend not in ("xgboost", "sklearn")
        or metadata.get("backend") != artifact.backend
        or metadata.get("sequence_length") != sequence_length
        or metadata.get("n_features") != sequence_length * n_features
        or getattr(artifact, "n_features", None) != sequence_length * n_features
        or getattr(artifact, "window_shape", None) != (sequence_length, n_features)
        or trained_horizon(metadata) is None
        or getattr(artifact, "trained_horizon_sessions", None) != trained_horizon(metadata)
    ):
        return "artifact_incompatible"
    if trained_horizon(metadata) != horizon:
        return "horizon_mismatch"
    return None


def no_change_prediction(df: pd.DataFrame, artifact, metadata: dict, reason: str, slot: str) -> dict:
    """Represent an unavailable forecast without inventing a trading signal."""
    try:
        current_price = float(df["Close"].iloc[-1])
        price = round(current_price, 2) if np.isfinite(current_price) and current_price > 0 else None
    except (KeyError, IndexError, TypeError, ValueError):
        price = None
    return {
        "predicted_price": price,
        "predicted_return": 0.0,
        "confidence": 0.0,
        "confidence_breakdown": {"technical": 0.0, "fundamental": 0.0, "sentiment": 0.0, "historical": 0.0},
        "short_term_signal": {"signal": "HOLD", "score": 5.0},
        "long_term_signal": {"signal": "HOLD", "score": 5.0},
        "indicators": [{"name": f"{slot} forecast unavailable", "value": 0.0, "signal": "Neutral"}],
        "fallback": True,
        "fallback_reason": reason,
        "backend": artifact_backend(artifact),
        "trained_horizon_sessions": trained_horizon(metadata),
    }


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
            n_jobs=2,
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
    label_end_stamps: np.ndarray | None = None,
    purge_days: int = 0,
) -> tuple[GradientBoostArtifact, dict]:
    """
    Fit an origin-date split with training labels resolved before validation.

    The final approximately 20% of windows are held out, including every ticker
    sharing the first validation origin. Actual label-end timestamps enforce
    availability even when sessions have gaps or trading is suspended.
    `purge_days` optionally adds a calendar embargo; it never substitutes for
    checking the label-resolution boundary.
    """
    windows = np.asarray(windows, dtype=float)
    if windows.ndim != 3:
        raise ValueError("Training windows must have batch, sequence and feature dimensions.")
    X = windows.reshape(windows.shape[0], -1)
    y = np.asarray(targets, dtype=float).reshape(-1)

    if len(X) < 40:
        raise ValueError("Not enough training windows for the gradient-boosted model.")

    if len(y) != len(X) or not np.isfinite(X).all() or not np.isfinite(y).all():
        raise ValueError("Training features and targets must be finite and line up 1:1.")
    if stamps is None or label_end_stamps is None:
        raise ValueError("Origin and label-end timestamps are required for validation.")
    stamp_array = _to_utc_naive(stamps)
    label_ends = _to_utc_naive(label_end_stamps)
    if len(stamp_array) != len(X) or len(label_ends) != len(X):
        raise ValueError("Timestamps must line up 1:1 with the training windows.")
    if (
        np.isnat(stamp_array).any()
        or np.isnat(label_ends).any()
        or (np.diff(stamp_array) < np.timedelta64(0, "ns")).any()
        or (label_ends <= stamp_array).any()
        or purge_days < 0
    ):
        raise ValueError("Origin timestamps must be sorted and labels must resolve later.")

    # Keep every instrument on the same UTC calendar day in the same split,
    # including exchanges whose session timestamps have different offsets.
    validation_start = stamp_array[int(len(X) * 0.8)].astype("datetime64[D]").astype("datetime64[ns]")
    split = int(np.searchsorted(stamp_array, validation_start, side="left"))
    cutoff = validation_start - np.timedelta64(int(purge_days), "D")
    train_mask = (stamp_array < cutoff) & (label_ends < validation_start)
    train_rows = int(train_mask.sum())
    if train_rows < MIN_TRAIN_ROWS:
        raise ValueError(
            f"Purging unresolved labels and {purge_days} days leaves {train_rows} training rows "
            f"(minimum {MIN_TRAIN_ROWS}). Supply more history."
        )

    X_train, X_test = X[train_mask], X[split:]
    y_train, y_test = y[train_mask], y[split:]

    estimator = build_estimator(n_estimators=n_estimators, max_depth=max_depth)
    estimator.fit(X_train, y_train)

    predictions = np.asarray(estimator.predict(X_test), dtype=float).reshape(-1)
    if len(predictions) != len(y_test) or not np.isfinite(predictions).all():
        raise ValueError("Estimator returned invalid validation predictions.")
    mae = float(np.mean(np.abs(predictions - y_test)))
    rmse = float(np.sqrt(np.mean((predictions - y_test) ** 2)))

    # Baseline = predicting "no change". If the model cannot beat that, its
    # confidence should reflect it rather than reporting a flattering number.
    baseline_mae = float(np.mean(np.abs(y_test)))
    skill = None if baseline_mae == 0 else 1.0 - (mae / baseline_mae)

    def utc_string(stamp):
        return pd.Timestamp(stamp).isoformat() + "Z"

    artifact = GradientBoostArtifact(
        estimator, n_features=X.shape[1], window_shape=windows.shape[1:]
    )
    metrics = {
        "validation_mae": mae,
        "validation_rmse": rmse,
        "baseline_mae": baseline_mae,
        "skill_vs_no_change": skill,
        "confidence": 0.0 if skill is None else float(max(0.0, min(85.0, 40.0 + skill * 50.0))),
        "training_windows": int(len(X)),
        "train_rows": int(len(X_train)),
        "train_origin_start": utc_string(stamp_array[train_mask].min()),
        "train_origin_end": utc_string(stamp_array[train_mask].max()),
        "train_label_end": utc_string(label_ends[train_mask].max()),
        "validation_rows": int(len(X_test)),
        "validation_start": utc_string(validation_start),
        "validation_end": utc_string(stamp_array[-1]),
        "validation_label_end": utc_string(label_ends[split:].max()),
        "validation_method": "chronological-purged",
        "purge_days": int(purge_days),
        "purged_rows": int(split - train_rows),
        "n_features": int(X.shape[1]),
        "backend": artifact.backend,
    }

    return artifact, metrics


def build_training_windows(
    datasets,
    prepare,
    sequence_length: int,
    horizon_days: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Turn raw OHLCV frames into (windows, forward-return targets).

    `prepare` is the owning model's own feature function, so each slot keeps the
    feature set it was designed around rather than sharing one generic set.
    Targets stop `horizon_days` before the end of each frame -- beyond that the
    realised forward return does not exist yet and would be fabricated.

    Returns (windows, targets, origins, label_ends), sorted across all frames.
    Each window includes the origin close, matching the latest-window serving
    call. The label is the return from that close to the close exactly
    `horizon_days` observed sessions later. Actual dates survive pooling so
    validation can exclude every training label unresolved at its start.
    """
    if sequence_length < 1 or horizon_days < 1:
        raise ValueError("Sequence length and forecast horizon must be positive.")
    stamps: list = []
    label_ends: list = []
    windows: list[np.ndarray] = []
    targets: list[float] = []

    for frame in datasets:
        if len(frame) < sequence_length + horizon_days + 30:
            continue

        if not frame.index.is_monotonic_increasing or not frame.index.is_unique:
            raise ValueError("Training histories must have unique, sorted session timestamps.")
        features = np.asarray(prepare(frame), dtype=float)
        if features.ndim != 2 or len(features) != len(frame):
            raise ValueError("Prepared features must line up 1:1 with history rows.")
        close = np.asarray(frame["Close"].values, dtype=float)

        for idx in range(sequence_length - 1, len(close) - horizon_days):
            start, future = close[idx], close[idx + horizon_days]

            # Skip rather than impute: a non-finite price means the label would
            # be invented. Boosters reject NaN labels outright, and silently
            # zero-filling them would teach the model that gaps mean "no move".
            if not np.isfinite(start) or not np.isfinite(future) or start <= 0 or future <= 0:
                continue

            window = features[idx - sequence_length + 1 : idx + 1]
            if not np.isfinite(window).all():
                continue

            stamps.append(frame.index[idx])
            label_ends.append(frame.index[idx + horizon_days])
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
        _to_utc_naive(label_ends)[order],
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
