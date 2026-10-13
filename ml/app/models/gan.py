"""
Artifact-backed second sequence regression slot for stock price prediction.

Training is performed offline; runtime inference only loads the saved
gradient-boosted artifact on startup. Optional TensorFlow GAN training is
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

logger = logging.getLogger("roneira-ml.gan")


class GANPredictor:
    """Second sequence slot backed by a fitted gradient-boosted artifact."""

    features_per_session = 6

    gb_model_filename = "gan_gbm.joblib"
    metadata_filename = "gan_metadata.json"

    def __init__(self, sequence_length: int = 30, latent_dim: int = 32, epochs: int = 20, batch_size: int = 32):
        self.sequence_length = sequence_length
        self._generator = None
        self._metadata: dict[str, float | int | str | list[str]] = {}
        self._load_artifact_bundle()

    def is_ready(self) -> bool:
        return artifact_contract_reason(
            self._generator, self._metadata, self.sequence_length,
            self.features_per_session, trained_horizon(self._metadata) or 0,
        ) is None

    def _load_artifact_bundle(self):
        """
        Loads the GAN generator and metadata from artifacts on boot.
        This enables rapid scaling as inference nodes don't need to retrain.

        The gradient-boosted bundle is the supported backend. Legacy Keras
        artifacts have no validated origin/horizon contract and are not served.
        """
        self._metadata = load_metadata(self.metadata_filename)
        gb_path = artifact_path(self.gb_model_filename)
        gb_model = load_artifact(gb_path)
        if gb_model is not None:
            self._generator = gb_model
            sequence_length = self._metadata.get("sequence_length")
            if isinstance(sequence_length, int) and not isinstance(sequence_length, bool) and sequence_length > 0:
                self.sequence_length = sequence_length
            logger.info("Loaded gradient-boosted GAN-slot artifact from %s", gb_path)

    def _prepare_data(self, df: pd.DataFrame) -> np.ndarray:
        features = pd.DataFrame(index=df.index)
        # See lstm.py's _prepare_features: `Close / Close.iloc[0]` was this
        # booster's top feature at 0.31 importance and depended entirely on the
        # caller's `period=` argument -- ~9.4 when training on period="max",
        # ~1.5 when serving a "1y" fetch of the very same sessions.
        features["trend_150"] = (
            df["Close"] / df["Close"].rolling(150, min_periods=1).mean()
        )
        features["returns"] = df["Close"].pct_change().fillna(0)
        features["hl_range"] = (df["High"] - df["Low"]) / df["Close"]
        features["volume_norm"] = df["Volume"] / df["Volume"].rolling(20).mean().fillna(1)
        features["sma_ratio"] = df["Close"].rolling(20).mean().fillna(df["Close"]) / df["Close"]
        features["volatility"] = df["Close"].pct_change().rolling(10).std().fillna(0)
        return features.fillna(0).values

    def train(self, datasets: list[pd.DataFrame], horizon_days: int = 30) -> dict:
        """The optional TensorFlow path is experimental and unvalidated."""
        raise RuntimeError(
            "TensorFlow GAN training is experimental and has no validated "
            "origin/horizon contract. Use train_gradient_boost instead."
        )

    def train_gradient_boost(self, datasets: list[pd.DataFrame], horizon_days: int = 30) -> dict:
        """
        Train the gradient-boosted backend for this slot.

        This backend is a deterministic point estimate; its heuristic score
        derives from validation error against the no-change baseline.
        """
        windows, targets, stamps, label_ends = build_training_windows(
            datasets,
            self._prepare_data,
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
                "backend_slot": "gan",
                "trained_on_frames": len(datasets),
            }
        )
        save_metadata(self.metadata_filename, metrics)

        self._generator = artifact
        self._metadata = metrics
        return metrics

    def predict(self, df: pd.DataFrame, horizon_days: int = 30) -> dict:
        """
        Infer only the origin-inclusive task described by the loaded bundle.
        Missing, incompatible or unsupported bundles produce an explicit HOLD.
        """
        reason = artifact_contract_reason(
            self._generator, self._metadata, self.sequence_length,
            self.features_per_session, horizon_days,
        )
        if reason:
            return self._fallback_predict(df, horizon_days, reason)

        try:
            features = self._prepare_data(df)
            if len(features) < self.sequence_length:
                return self._fallback_predict(df, horizon_days, "invalid_input")

            latest_seq = features[-self.sequence_length:].reshape(1, self.sequence_length, features.shape[1])
            current_price = float(df["Close"].iloc[-1])
            if (
                latest_seq.shape[2] != self.features_per_session
                or not np.isfinite(latest_seq).all()
                or not np.isfinite(current_price)
                or current_price <= 0
            ):
                return self._fallback_predict(df, horizon_days, "invalid_input")
            # One deterministic call. Multiple calls cannot measure a spread
            # for this regressor; no stochastic interval is advertised.
            prediction = float(self._generator.predict(latest_seq, verbose=0)[0][0])
            if not np.isfinite(prediction):
                return self._fallback_predict(df, horizon_days, "inference_failed")

            predicted_return = float(np.clip(prediction, -0.25, 0.25))
            predicted_price = current_price * (1 + predicted_return)
            confidence = float(self._metadata.get("confidence", 0.0))
            if not np.isfinite(confidence):
                return self._fallback_predict(df, horizon_days, "artifact_incompatible")
            confidence = float(np.clip(confidence, 0.0, 85.0))

            if predicted_return > 0.04:
                signal = "STRONG_BUY"
                score = 8.0
            elif predicted_return > 0.015:
                signal = "BUY"
                score = 6.6
            elif predicted_return > -0.015:
                signal = "HOLD"
                score = 5.0
            elif predicted_return > -0.04:
                signal = "SELL"
                score = 3.4
            else:
                signal = "STRONG_SELL"
                score = 1.8

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
                "long_term_signal": {"signal": signal, "score": round(min(10, score + 0.4), 1)},
                "indicators": [
                    {"name": "Sequence Booster Return (%)", "value": round(predicted_return * 100, 4), "signal": "Buy" if predicted_return > 0 else "Sell"},
                    {"name": "Validation MAE (% return)", "value": round(float(self._metadata.get("validation_mae", 0.0)) * 100, 4), "signal": "Neutral"},
                ],
                "training_info": self._metadata,
                "backend": artifact_backend(self._generator),
                "trained_horizon_sessions": trained_horizon(self._metadata),
            }
        except Exception as exc:
            logger.error("GAN prediction error: %s", exc)
            return self._fallback_predict(df, horizon_days, "inference_failed")

    def _fallback_predict(self, df: pd.DataFrame, horizon_days: int, reason: str = "artifact_unavailable") -> dict:
        return no_change_prediction(df, self._generator, self._metadata, reason, "GAN slot")
