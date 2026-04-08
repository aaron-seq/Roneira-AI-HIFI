"""
Artifact-backed LSTM model for stock price prediction.

Training happens offline through `ml/train_models.py`; runtime inference only
loads a bundled `.keras` artifact on startup and falls back when unavailable.
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from app.models.artifacts import artifact_path, load_metadata, save_metadata

logger = logging.getLogger("roneira-ml.lstm")

try:
    import tensorflow as tf
    from tensorflow import keras

    TF_AVAILABLE = True
    logger.info("TensorFlow %s loaded for LSTM inference", tf.__version__)
except ImportError:
    TF_AVAILABLE = False
    keras = None
    logger.warning("TensorFlow not available — LSTM model will use fallback")


class LSTMPredictor:
    """LSTM deep learning model backed by a saved Keras artifact."""

    model_filename = "lstm_model.keras"
    metadata_filename = "lstm_metadata.json"

    def __init__(self, sequence_length: int = 60, epochs: int = 25, batch_size: int = 32):
        self.sequence_length = sequence_length
        self.epochs = epochs
        self.batch_size = batch_size
        self._model = None
        self._metadata: dict[str, float | int | str | list[str]] = {}
        self._load_artifact_bundle()

    def is_ready(self) -> bool:
        return self._model is not None

    def _load_model_from_disk(self, path: Path):
        if keras is None:
            return None
        return keras.models.load_model(path, compile=False)

    def _load_artifact_bundle(self):
        self._metadata = load_metadata(self.metadata_filename)
        path = artifact_path(self.model_filename)

        if not TF_AVAILABLE or not path.exists():
            if path.exists():
                logger.warning("LSTM artifact found but TensorFlow is unavailable")
            return

        try:
            self._model = self._load_model_from_disk(path)
            stored_sequence_length = int(self._metadata.get("sequence_length", self.sequence_length))
            self.sequence_length = stored_sequence_length
            logger.info("Loaded LSTM artifact from %s", path)
        except Exception as exc:
            logger.error("Failed to load LSTM artifact: %s", exc)
            self._model = None

    def _build_model(self, input_shape: tuple[int, int]):
        if keras is None:
            return None

        model = keras.Sequential([
            keras.layers.Input(shape=input_shape),
            keras.layers.LSTM(96, return_sequences=True),
            keras.layers.Dropout(0.2),
            keras.layers.LSTM(48, return_sequences=False),
            keras.layers.Dropout(0.15),
            keras.layers.Dense(24, activation="relu"),
            keras.layers.Dense(1),
        ])

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss="mse",
            metrics=["mae"],
        )
        return model

    def _prepare_features(self, df: pd.DataFrame) -> np.ndarray:
        features = pd.DataFrame(index=df.index)
        features["close_norm"] = df["Close"] / df["Close"].iloc[0]
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

    def _normalize(self, data: np.ndarray) -> np.ndarray:
        mins = data.min(axis=0)
        maxs = data.max(axis=0)
        ranges = maxs - mins
        ranges[ranges == 0] = 1
        return (data - mins) / ranges

    def _create_sequences(self, data: np.ndarray, target: np.ndarray):
        features, labels = [], []
        for idx in range(self.sequence_length, len(data)):
            features.append(data[idx - self.sequence_length:idx])
            labels.append(target[idx])
        return np.array(features), np.array(labels)

    def train(self, datasets: list[pd.DataFrame], horizon_days: int = 30) -> dict:
        if not TF_AVAILABLE:
            raise RuntimeError("TensorFlow is required to train the LSTM model.")

        sequence_batches: list[np.ndarray] = []
        label_batches: list[np.ndarray] = []

        for frame in datasets:
            if len(frame) < self.sequence_length + horizon_days + 30:
                continue

            features = self._normalize(self._prepare_features(frame))
            close_prices = frame["Close"].values
            target_returns = np.zeros(len(close_prices))
            for idx in range(len(close_prices) - horizon_days):
                target_returns[idx] = (
                    close_prices[idx + horizon_days] - close_prices[idx]
                ) / close_prices[idx]

            valid_end = len(close_prices) - horizon_days
            X_batch, y_batch = self._create_sequences(
                features[:valid_end],
                target_returns[:valid_end],
            )

            if len(X_batch) == 0:
                continue

            sequence_batches.append(X_batch)
            label_batches.append(y_batch)

        if not sequence_batches:
            raise ValueError("No suitable training windows were created for the LSTM model.")

        X = np.concatenate(sequence_batches)
        y = np.concatenate(label_batches)

        split = int(len(X) * 0.8)
        X_train, X_test = X[:split], X[split:]
        y_train, y_test = y[:split], y[split:]

        model = self._build_model((self.sequence_length, X.shape[2]))
        if model is None:
            raise RuntimeError("Keras model could not be created for LSTM training.")

        early_stop = keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=5,
            restore_best_weights=True,
        )

        history = model.fit(
            X_train,
            y_train,
            validation_data=(X_test, y_test),
            epochs=self.epochs,
            batch_size=self.batch_size,
            callbacks=[early_stop],
            verbose=0,
        )

        loss, mae = model.evaluate(X_test, y_test, verbose=0)
        model_path = artifact_path(self.model_filename)
        model_path.parent.mkdir(parents=True, exist_ok=True)
        model.save(model_path)

        metadata = {
            "sequence_length": self.sequence_length,
            "epochs_requested": self.epochs,
            "epochs_run": len(history.history.get("val_loss", [])),
            "validation_loss": float(loss),
            "validation_mae": float(mae),
            "confidence": float(max(35, min(90, 75 - mae * 200))),
            "trained_on": len(datasets),
        }
        save_metadata(self.metadata_filename, metadata)

        self._metadata = metadata
        self._model = model
        return metadata

    def predict(self, df: pd.DataFrame, horizon_days: int = 30) -> dict:
        if self._model is None:
            return self._fallback_predict(df, horizon_days)

        try:
            features = self._normalize(self._prepare_features(df))
            if len(features) < self.sequence_length:
                return self._fallback_predict(df, horizon_days)

            latest_sequence = features[-self.sequence_length:].reshape(1, self.sequence_length, -1)
            predicted_return = float(self._model.predict(latest_sequence, verbose=0)[0][0])
            predicted_return = float(np.clip(predicted_return, -0.25, 0.25))

            current_price = float(df["Close"].iloc[-1])
            predicted_price = current_price * (1 + predicted_return)
            confidence = float(self._metadata.get("confidence", 55.0))

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
                    "technical": round(confidence * 0.92, 1),
                    "fundamental": round(confidence * 0.68, 1),
                    "sentiment": round(confidence * 0.55, 1),
                    "historical": round(confidence, 1),
                },
                "short_term_signal": {"signal": signal, "score": round(score, 1)},
                "long_term_signal": {"signal": signal, "score": round(min(10, score + 0.3), 1)},
                "indicators": [
                    {"name": "LSTM Predicted Return", "value": round(predicted_return * 100, 4), "signal": "Buy" if predicted_return > 0 else "Sell"},
                    {"name": "Validation MAE", "value": round(float(self._metadata.get("validation_mae", 0.0)), 6), "signal": "Buy"},
                    {"name": "Epochs Run", "value": float(self._metadata.get("epochs_run", 0)), "signal": "Neutral"},
                ],
                "model_score": round(max(0.0, 1 - float(self._metadata.get("validation_mae", 0.0))), 4),
                "training_info": self._metadata,
            }
        except Exception as exc:
            logger.error("LSTM prediction error: %s", exc)
            return self._fallback_predict(df, horizon_days)

    def _fallback_predict(self, df: pd.DataFrame, horizon_days: int) -> dict:
        close = df["Close"]
        current_price = float(close.iloc[-1])
        recent_returns = close.pct_change(5).dropna()
        avg_daily_return = float(recent_returns.mean()) / 5 if len(recent_returns) else 0
        predicted_price = current_price * (1 + avg_daily_return * horizon_days * 0.5)
        predicted_return = (predicted_price - current_price) / current_price

        return {
            "predicted_price": round(predicted_price, 2),
            "predicted_return": round(predicted_return * 100, 2),
            "confidence": 35.0,
            "confidence_breakdown": {
                "technical": 35.0,
                "fundamental": 25.0,
                "sentiment": 20.0,
                "historical": 30.0,
            },
            "short_term_signal": {
                "signal": "BUY" if predicted_return > 0.01 else ("SELL" if predicted_return < -0.01 else "HOLD"),
                "score": 5.0,
            },
            "long_term_signal": {"signal": "HOLD", "score": 5.0},
            "indicators": [
                {"name": "LSTM (Fallback)", "value": round(predicted_return * 100, 4), "signal": "Neutral"},
            ],
            "fallback": True,
        }
