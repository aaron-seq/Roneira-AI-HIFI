"""
Artifact-backed GAN generator for stock price prediction.

Training is performed offline; runtime inference only loads the saved
generator artifact on startup and falls back when unavailable.
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from app.models.artifacts import artifact_path, load_metadata, save_metadata

logger = logging.getLogger("roneira-ml.gan")

try:
    import tensorflow as tf
    from tensorflow import keras

    TF_AVAILABLE = True
    logger.info("TensorFlow %s loaded for GAN inference", tf.__version__)
except ImportError:
    TF_AVAILABLE = False
    keras = None
    logger.warning("TensorFlow not available — GAN model will use fallback")


class GANPredictor:
    """GAN-based price trajectory predictor backed by a saved generator artifact."""

    model_filename = "gan_generator.keras"
    metadata_filename = "gan_metadata.json"

    def __init__(self, sequence_length: int = 30, latent_dim: int = 32, epochs: int = 20, batch_size: int = 32):
        self.sequence_length = sequence_length
        self.latent_dim = latent_dim
        self.epochs = epochs
        self.batch_size = batch_size
        self._generator = None
        self._metadata: dict[str, float | int | str | list[str]] = {}
        self._load_artifact_bundle()

    def is_ready(self) -> bool:
        return self._generator is not None

    def _load_model_from_disk(self, path: Path):
        if keras is None:
            return None
        return keras.models.load_model(path, compile=False)

    def _load_artifact_bundle(self):
        """
        Loads the GAN generator and metadata from artifacts on boot.
        This enables rapid scaling as inference nodes don't need to retrain.
        """
        self._metadata = load_metadata(self.metadata_filename)
        path = artifact_path(self.model_filename)

        if not TF_AVAILABLE or not path.exists():
            if path.exists():
                logger.warning("GAN artifact found but TensorFlow is unavailable")
            return

        try:
            self._generator = self._load_model_from_disk(path)
            self.sequence_length = int(self._metadata.get("sequence_length", self.sequence_length))
            self.latent_dim = int(self._metadata.get("latent_dim", self.latent_dim))
            logger.info("Loaded GAN artifact from %s", path)
        except Exception as exc:
            logger.error("Failed to load GAN artifact: %s", exc)
            self._generator = None

    def _build_generator(self, n_features: int):
        if keras is None:
            return None

        noise_input = keras.layers.Input(shape=(self.latent_dim,))
        condition_input = keras.layers.Input(shape=(self.sequence_length, n_features))

        condition = keras.layers.LSTM(64, return_sequences=False)(condition_input)
        condition = keras.layers.Dense(32, activation="relu")(condition)
        merged = keras.layers.Concatenate()([noise_input, condition])
        x = keras.layers.Dense(64, activation="relu")(merged)
        x = keras.layers.Dense(32, activation="relu")(x)
        output = keras.layers.Dense(1, activation="linear")(x)
        return keras.Model(inputs=[noise_input, condition_input], outputs=output)

    def _build_discriminator(self, n_features: int):
        if keras is None:
            return None

        seq_input = keras.layers.Input(shape=(self.sequence_length, n_features))
        target_input = keras.layers.Input(shape=(1,))
        x = keras.layers.LSTM(64, return_sequences=False)(seq_input)
        x = keras.layers.Dense(32, activation="relu")(x)
        merged = keras.layers.Concatenate()([x, target_input])
        merged = keras.layers.Dense(32, activation="relu")(merged)
        merged = keras.layers.Dropout(0.3)(merged)
        output = keras.layers.Dense(1, activation="sigmoid")(merged)
        model = keras.Model(inputs=[seq_input, target_input], outputs=output)
        model.compile(
            optimizer=keras.optimizers.Adam(0.0002),
            loss="binary_crossentropy",
            metrics=["accuracy"],
        )
        return model

    def _prepare_data(self, df: pd.DataFrame) -> np.ndarray:
        features = pd.DataFrame(index=df.index)
        features["close_norm"] = df["Close"] / df["Close"].iloc[0]
        features["returns"] = df["Close"].pct_change().fillna(0)
        features["hl_range"] = (df["High"] - df["Low"]) / df["Close"]
        features["volume_norm"] = df["Volume"] / df["Volume"].rolling(20).mean().fillna(1)
        features["sma_ratio"] = df["Close"].rolling(20).mean().fillna(df["Close"]) / df["Close"]
        features["volatility"] = df["Close"].pct_change().rolling(10).std().fillna(0)
        return features.fillna(0).values

    def _create_sequences(self, data: np.ndarray, target: np.ndarray):
        features, labels = [], []
        for idx in range(self.sequence_length, len(data)):
            features.append(data[idx - self.sequence_length:idx])
            labels.append(target[idx])
        return np.array(features), np.array(labels).reshape(-1, 1)

    def train(self, datasets: list[pd.DataFrame], horizon_days: int = 30) -> dict:
        """
        Offline GAN training entrypoint. Called via cron or admin trigger.
        Saves the generator component as a `.keras` artifact for inference.
        """
        if not TF_AVAILABLE:
            raise RuntimeError("TensorFlow is required to train the GAN model.")

        sequence_batches: list[np.ndarray] = []
        label_batches: list[np.ndarray] = []

        for frame in datasets:
            if len(frame) < self.sequence_length + horizon_days + 30:
                continue

            features = self._prepare_data(frame)
            close_prices = frame["Close"].values
            target_returns = np.zeros(len(close_prices))
            valid_end = len(close_prices) - horizon_days

            if valid_end > 0:
                target_returns[:valid_end] = (
                    close_prices[horizon_days:] - close_prices[:-horizon_days]
                ) / close_prices[:-horizon_days]
            X_batch, y_batch = self._create_sequences(
                features[:valid_end],
                target_returns[:valid_end],
            )

            if len(X_batch) == 0:
                continue

            sequence_batches.append(X_batch)
            label_batches.append(y_batch)

        if not sequence_batches:
            raise ValueError("No suitable training windows were created for the GAN model.")

        X = np.concatenate(sequence_batches)
        y = np.concatenate(label_batches)
        n_features = X.shape[2]

        generator = self._build_generator(n_features)
        discriminator = self._build_discriminator(n_features)
        if generator is None or discriminator is None:
            raise RuntimeError("GAN generator/discriminator could not be constructed.")

        batch_size = min(self.batch_size, max(8, len(X) // 5))
        g_losses: list[float] = []
        d_losses: list[float] = []

        for _ in range(self.epochs):
            idx = np.random.randint(0, len(X), batch_size)
            real_seq = X[idx]
            real_targets = y[idx]

            noise = np.random.normal(0, 1, (batch_size, self.latent_dim))
            fake_targets = generator.predict([noise, real_seq], verbose=0)

            d_loss_real = discriminator.train_on_batch([real_seq, real_targets], np.ones((batch_size, 1)) * 0.9)
            d_loss_fake = discriminator.train_on_batch([real_seq, fake_targets], np.zeros((batch_size, 1)))
            d_loss = 0.5 * (np.array(d_loss_real) + np.array(d_loss_fake))

            discriminator.trainable = False
            noise_input = keras.layers.Input(shape=(self.latent_dim,))
            seq_input = keras.layers.Input(shape=(self.sequence_length, n_features))
            combined_output = discriminator([seq_input, generator([noise_input, seq_input])])
            combined = keras.Model([noise_input, seq_input], combined_output)
            combined.compile(optimizer=keras.optimizers.Adam(0.0002), loss="binary_crossentropy")
            g_loss = combined.train_on_batch([noise, real_seq], np.ones((batch_size, 1)))
            discriminator.trainable = True

            g_losses.append(float(g_loss if isinstance(g_loss, (int, float)) else g_loss[0]))
            d_losses.append(float(d_loss[0] if hasattr(d_loss, "__len__") else d_loss))

        model_path = artifact_path(self.model_filename)
        model_path.parent.mkdir(parents=True, exist_ok=True)
        generator.save(model_path)

        metadata = {
            "sequence_length": self.sequence_length,
            "latent_dim": self.latent_dim,
            "epochs_run": self.epochs,
            "generator_loss": float(g_losses[-1]) if g_losses else 0.0,
            "discriminator_loss": float(d_losses[-1]) if d_losses else 0.0,
            "confidence": 55.0,
            "trained_on": len(datasets),
        }
        save_metadata(self.metadata_filename, metadata)

        self._metadata = metadata
        self._generator = generator
        return metadata

    def predict(self, df: pd.DataFrame, horizon_days: int = 30) -> dict:
        """
        Runs inference using the pre-loaded GAN generator artifact.
        Falls back to heuristics if the artifact is missing or fails.
        """
        if self._generator is None:
            return self._fallback_predict(df, horizon_days)

        try:
            features = self._prepare_data(df)
            if len(features) < self.sequence_length:
                return self._fallback_predict(df, horizon_days)

            latest_seq = features[-self.sequence_length:].reshape(1, self.sequence_length, features.shape[1])
            predictions = []
            for _ in range(5):
                noise = np.random.normal(0, 1, (1, self.latent_dim))
                prediction = float(self._generator.predict([noise, latest_seq], verbose=0)[0][0])
                predictions.append(prediction)

            predicted_return = float(np.clip(np.mean(predictions), -0.25, 0.25))
            pred_std = float(np.std(predictions))
            current_price = float(df["Close"].iloc[-1])
            predicted_price = current_price * (1 + predicted_return)
            confidence = float(max(30, min(85, self._metadata.get("confidence", 55.0) - pred_std * 100)))

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
                    "technical": round(confidence * 0.9, 1),
                    "fundamental": round(confidence * 0.65, 1),
                    "sentiment": round(confidence * 0.55, 1),
                    "historical": round(confidence * 0.85, 1),
                },
                "short_term_signal": {"signal": signal, "score": round(score, 1)},
                "long_term_signal": {"signal": signal, "score": round(min(10, score + 0.4), 1)},
                "indicators": [
                    {"name": "GAN Predicted Return", "value": round(predicted_return * 100, 4), "signal": "Buy" if predicted_return > 0 else "Sell"},
                    {"name": "Prediction Std", "value": round(pred_std * 100, 4), "signal": "Buy" if pred_std < 0.02 else "Neutral"},
                    {"name": "Generator Loss", "value": round(float(self._metadata.get("generator_loss", 0.0)), 4), "signal": "Neutral"},
                ],
                "training_info": self._metadata,
            }
        except Exception as exc:
            logger.error("GAN prediction error: %s", exc)
            return self._fallback_predict(df, horizon_days)

    def _fallback_predict(self, df: pd.DataFrame, horizon_days: int) -> dict:
        close = df["Close"]
        current_price = float(close.iloc[-1])
        trend = float(close.pct_change(20).iloc[-1]) / 20 if len(close) > 20 else 0
        predicted_price = current_price * (1 + trend * horizon_days * 0.4)
        predicted_return = (predicted_price - current_price) / current_price

        return {
            "predicted_price": round(predicted_price, 2),
            "predicted_return": round(predicted_return * 100, 2),
            "confidence": 30.0,
            "confidence_breakdown": {
                "technical": 30.0,
                "fundamental": 20.0,
                "sentiment": 15.0,
                "historical": 25.0,
            },
            "short_term_signal": {"signal": "HOLD", "score": 5.0},
            "long_term_signal": {"signal": "HOLD", "score": 5.0},
            "indicators": [{"name": "GAN (Fallback)", "value": round(predicted_return * 100, 4), "signal": "Neutral"}],
            "fallback": True,
        }
