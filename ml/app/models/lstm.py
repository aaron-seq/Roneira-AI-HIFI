"""
Artifact-backed sequence regression slot for stock price prediction.

Training happens offline through `ml/train_models.py`; runtime inference only
loads a gradient-boosted artifact on startup. Optional TensorFlow training is
experimental and unavailable until its validation contract has been corrected.
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from app.models.artifacts import artifact_path, load_metadata, save_metadata
from app.models.gradient_boost import (
    WINDOW_CONTRACT,
    artifact_backend,
    artifact_contract_reason,
    build_training_windows,
    fit_windows,
    load_artifact,
    no_change_prediction,
    save_artifact,
    trained_horizon,
)

logger = logging.getLogger("roneira-ml.lstm")


class LSTMPredictor:
    """Sequence model slot backed by a fitted gradient-boosted artifact."""

    features_per_session = 11

    gb_model_filename = "lstm_gbm.joblib"
    metadata_filename = "lstm_metadata.json"

    def __init__(self, sequence_length: int = 60, epochs: int = 25, batch_size: int = 32):
        self.sequence_length = sequence_length
        self._model = None
        self._metadata: dict[str, float | int | str | list[str]] = {}
        self._load_artifact_bundle()

    def is_ready(self) -> bool:
        return artifact_contract_reason(
            self._model, self._metadata, self.sequence_length,
            self.features_per_session, trained_horizon(self._metadata) or 0,
        ) is None

    def _load_artifact_bundle(self):
        """
        Loads model and metadata from `ml/artifacts/generated` on boot.
        This enables rapid scaling as inference nodes don't need to retrain.

        The gradient-boosted bundle is the supported backend. Legacy Keras
        artifacts have no validated origin/horizon contract and are not served.
        """
        self._metadata = load_metadata(self.metadata_filename)
        gb_path = artifact_path(self.gb_model_filename)
        gb_model = load_artifact(gb_path)
        if gb_model is not None:
            self._model = gb_model
            sequence_length = self._metadata.get("sequence_length")
            if isinstance(sequence_length, int) and not isinstance(sequence_length, bool) and sequence_length > 0:
                self.sequence_length = sequence_length
            logger.info("Loaded gradient-boosted LSTM-slot artifact from %s", gb_path)

    def _prepare_features(self, df: pd.DataFrame) -> np.ndarray:
        features = pd.DataFrame(index=df.index)
        # Trend relative to a *rolling* mean, not to df.iloc[0]. The old
        # `Close / Close.iloc[0]` was the booster's highest-importance column
        # (0.18) and also the one column whose value depended on how much
        # history the caller fetched: training used period="max", serving uses
        # "1y"/"2y", so the same session scored ~8.8 in training and ~1.4 at
        # serve time. 150 sessions of lookback keeps every row of a 60-day
        # window inside a 252-row (1y) fetch fully warmed up, so training and
        # serving see the identical number.
        features["trend_150"] = (
            df["Close"] / df["Close"].rolling(150, min_periods=1).mean()
        )
        features["returns"] = df["Close"].pct_change().fillna(0)
        features["high_low_range"] = (df["High"] - df["Low"]) / df["Close"]
        features["open_close_range"] = (df["Close"] - df["Open"]) / df["Close"]
        features["sma_5"] = df["Close"].rolling(5).mean() / df["Close"]
        features["sma_20"] = df["Close"].rolling(20).mean() / df["Close"]
        features["ema_12"] = df["Close"].ewm(span=12).mean() / df["Close"]
        features["volume_norm"] = df["Volume"] / df["Volume"].rolling(20).mean()

        delta = df["Close"].diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss.replace(0, np.nan)
        features["rsi"] = (100 - (100 / (1 + rs))) / 100

        ema12 = df["Close"].ewm(span=12).mean()
        ema26 = df["Close"].ewm(span=26).mean()
        features["macd"] = (ema12 - ema26) / df["Close"]
        features["volatility"] = df["Close"].pct_change().rolling(10).std()
        return features.fillna(0).values

    def train(self, datasets: list[pd.DataFrame], horizon_days: int = 30) -> dict:
        """The optional TensorFlow path is experimental and unvalidated."""
        raise RuntimeError(
            "TensorFlow LSTM training is experimental and has no validated "
            "origin/horizon contract. Use train_gradient_boost instead."
        )

    def train_gradient_boost(self, datasets: list[pd.DataFrame], horizon_days: int = 30) -> dict:
        """
        Train the gradient-boosted backend for this slot.

        Produces a joblib artifact that
        `_load_artifact_bundle` picks up on the next boot.

        Ratio and return features use the same scale at fit and serve time;
        frame-wide normalization would include future statistics and change
        scale whenever the caller fetched a different history depth.
        """
        windows, targets, stamps, label_ends = build_training_windows(
            datasets,
            self._prepare_features,
            self.sequence_length,
            horizon_days,
        )
        artifact, metrics = fit_windows(
            windows,
            targets,
            stamps=stamps,
            label_end_stamps=label_ends,
        )
        artifact.trained_horizon_sessions = horizon_days
        save_artifact(artifact, artifact_path(self.gb_model_filename))

        metrics.update(
            {
                "sequence_length": self.sequence_length,
                "horizon_days": horizon_days,
                "window_contract": WINDOW_CONTRACT,
                "backend_slot": "lstm",
                "trained_on_frames": len(datasets),
            }
        )
        save_metadata(self.metadata_filename, metrics)

        self._model = artifact
        self._metadata = metrics
        return metrics

    def predict(self, df: pd.DataFrame, horizon_days: int = 30) -> dict:
        """
        Infer only the origin-inclusive task described by the loaded bundle.
        Missing, incompatible or unsupported bundles produce an explicit HOLD.
        """
        reason = artifact_contract_reason(
            self._model, self._metadata, self.sequence_length,
            self.features_per_session, horizon_days,
        )
        if reason:
            return self._fallback_predict(df, horizon_days, reason)

        try:
            features = self._prepare_features(df)
            if len(features) < self.sequence_length:
                return self._fallback_predict(df, horizon_days, "invalid_input")

            latest_sequence = features[-self.sequence_length:].reshape(1, self.sequence_length, -1)
            current_price = float(df["Close"].iloc[-1])
            if (
                latest_sequence.shape[2] != self.features_per_session
                or not np.isfinite(latest_sequence).all()
                or not np.isfinite(current_price)
                or current_price <= 0
            ):
                return self._fallback_predict(df, horizon_days, "invalid_input")
            predicted_return = float(self._model.predict(latest_sequence, verbose=0)[0][0])
            if not np.isfinite(predicted_return):
                return self._fallback_predict(df, horizon_days, "inference_failed")
            predicted_return = float(np.clip(predicted_return, -0.25, 0.25))

            predicted_price = current_price * (1 + predicted_return)
            confidence = float(self._metadata.get("confidence", 0.0))
            if not np.isfinite(confidence):
                return self._fallback_predict(df, horizon_days, "artifact_incompatible")
            confidence = float(np.clip(confidence, 0.0, 85.0))

            if predicted_return > 0.05:
                signal = "STRONG_BUY"
                score = 8.5
            elif predicted_return > 0.02:
                signal = "BUY"
                score = 6.8
            elif predicted_return > -0.02:
                signal = "HOLD"
                score = 5.0
            elif predicted_return > -0.05:
                signal = "SELL"
                score = 3.2
            else:
                signal = "STRONG_SELL"
                score = 1.5

            return {
                "predicted_price": round(predicted_price, 2),
                "predicted_return": round(predicted_return * 100, 2),
                "confidence": round(confidence, 1),
                "confidence_breakdown": {
                    "technical": 0.0,
                    "fundamental": 0.0,
                    "sentiment": 0.0,
                    "historical": round(confidence, 1),
                },
                "short_term_signal": {"signal": signal, "score": round(score, 1)},
                "long_term_signal": {"signal": signal, "score": round(min(10, score + 0.3), 1)},
                "indicators": [
                    {"name": "Sequence Booster Return (%)", "value": round(predicted_return * 100, 4), "signal": "Buy" if predicted_return > 0 else "Sell"},
                    {"name": "Validation MAE (% return)", "value": round(float(self._metadata.get("validation_mae", 0.0)) * 100, 4), "signal": "Neutral"},
                ],
                "training_info": self._metadata,
                "backend": artifact_backend(self._model),
                "trained_horizon_sessions": trained_horizon(self._metadata),
            }
        except Exception as exc:
            logger.error("LSTM prediction error: %s", exc)
            return self._fallback_predict(df, horizon_days, "inference_failed")

    def _fallback_predict(self, df: pd.DataFrame, horizon_days: int, reason: str = "artifact_unavailable") -> dict:
        return no_change_prediction(df, self._model, self._metadata, reason, "LSTM slot")
