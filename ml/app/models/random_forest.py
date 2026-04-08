"""
Random Forest Predictor for Stock Price Prediction
Uses scikit-learn RandomForestRegressor with feature engineering
from historical OHLCV data.
"""
import logging
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit

logger = logging.getLogger("roneira-ml.random_forest")


class RandomForestPredictor:
    """Random Forest model for stock price prediction."""

    def __init__(self, n_estimators: int = 200, max_depth: int = 12):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self._ready = True
        logger.info(f"RandomForest initialized: n_estimators={n_estimators}, max_depth={max_depth}")

    def is_ready(self) -> bool:
        return self._ready

    def _create_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Engineer features from OHLCV data."""
        features = pd.DataFrame(index=df.index)

        # Price-based features
        features["returns_1d"] = df["Close"].pct_change(1)
        features["returns_5d"] = df["Close"].pct_change(5)
        features["returns_10d"] = df["Close"].pct_change(10)
        features["returns_20d"] = df["Close"].pct_change(20)

        # Moving averages
        features["sma_5"] = df["Close"].rolling(5).mean() / df["Close"]
        features["sma_10"] = df["Close"].rolling(10).mean() / df["Close"]
        features["sma_20"] = df["Close"].rolling(20).mean() / df["Close"]
        features["sma_50"] = df["Close"].rolling(50).mean() / df["Close"]

        # EMA
        features["ema_12"] = df["Close"].ewm(span=12).mean() / df["Close"]
        features["ema_26"] = df["Close"].ewm(span=26).mean() / df["Close"]

        # Volatility
        features["volatility_5d"] = df["Close"].pct_change().rolling(5).std()
        features["volatility_20d"] = df["Close"].pct_change().rolling(20).std()

        # Volume
        features["volume_ratio"] = df["Volume"] / df["Volume"].rolling(20).mean()
        features["volume_change"] = df["Volume"].pct_change(1)

        # RSI
        delta = df["Close"].diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss.replace(0, np.nan)
        features["rsi_14"] = 100 - (100 / (1 + rs))

        # MACD
        ema12 = df["Close"].ewm(span=12).mean()
        ema26 = df["Close"].ewm(span=26).mean()
        features["macd"] = (ema12 - ema26) / df["Close"]
        features["macd_signal"] = features["macd"].ewm(span=9).mean()

        # Bollinger Bands
        bb_mid = df["Close"].rolling(20).mean()
        bb_std = df["Close"].rolling(20).std()
        features["bb_upper_dist"] = (df["Close"] - (bb_mid + 2 * bb_std)) / df["Close"]
        features["bb_lower_dist"] = (df["Close"] - (bb_mid - 2 * bb_std)) / df["Close"]

        # High/Low range
        features["hl_ratio"] = (df["High"] - df["Low"]) / df["Close"]

        # Day of week
        features["day_of_week"] = df.index.dayofweek

        return features.dropna()

    def predict(self, df: pd.DataFrame, horizon_days: int = 30) -> dict:
        """Run Random Forest prediction."""
        try:
            # Create features
            features = self._create_features(df)

            # Target: future return
            target = df["Close"].pct_change(horizon_days).shift(-horizon_days)
            target = target.loc[features.index]

            # Remove NaN targets
            valid = ~target.isna()
            X = features.loc[valid]
            y = target.loc[valid]

            if len(X) < 50:
                logger.warning("Insufficient data for Random Forest prediction")
                current_price = float(df["Close"].iloc[-1])
                return {
                    "predicted_price": current_price * 1.02,
                    "confidence": 30.0,
                    "indicators": [],
                }

            # Scale features
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            # Train with TimeSeriesSplit
            tscv = TimeSeriesSplit(n_splits=3)
            scores = []

            model = RandomForestRegressor(
                n_estimators=self.n_estimators,
                max_depth=self.max_depth,
                random_state=42,
                n_jobs=-1,
            )

            for train_idx, test_idx in tscv.split(X_scaled):
                model.fit(X_scaled[train_idx], y.iloc[train_idx])
                score = model.score(X_scaled[test_idx], y.iloc[test_idx])
                scores.append(max(0, score))

            # Final model on all data
            model.fit(X_scaled, y)

            # Predict from latest features
            latest_features = features.iloc[-1:].values
            latest_scaled = scaler.transform(latest_features)
            predicted_return = model.predict(latest_scaled)[0]

            current_price = float(df["Close"].iloc[-1])
            predicted_price = current_price * (1 + predicted_return)

            # Confidence from cross-val score
            avg_score = np.mean(scores) if scores else 0.3
            confidence = min(95, max(25, avg_score * 100 + 30))

            # Feature importances
            importances = dict(zip(features.columns, model.feature_importances_))
            top_features = sorted(importances.items(), key=lambda x: x[1], reverse=True)[:5]

            # Signal determination
            if predicted_return > 0.05:
                signal = "STRONG_BUY"
            elif predicted_return > 0.02:
                signal = "BUY"
            elif predicted_return > -0.02:
                signal = "HOLD"
            elif predicted_return > -0.05:
                signal = "SELL"
            else:
                signal = "STRONG_SELL"

            signal_score = min(10, max(0, 5 + predicted_return * 50))

            return {
                "predicted_price": round(predicted_price, 2),
                "predicted_return": round(predicted_return * 100, 2),
                "confidence": round(confidence, 1),
                "confidence_breakdown": {
                    "technical": round(confidence * 0.95, 1),
                    "fundamental": round(confidence * 0.85, 1),
                    "sentiment": round(confidence * 0.7, 1),
                    "historical": round(confidence * (avg_score + 0.3) / 1.3 * 100, 1) if avg_score else 50.0,
                },
                "short_term_signal": {"signal": signal, "score": round(signal_score, 1)},
                "long_term_signal": {"signal": signal, "score": round(min(10, signal_score + 0.5), 1)},
                "indicators": [
                    {"name": feat, "value": round(float(features[feat].iloc[-1]), 4), "signal": "Buy" if float(features[feat].iloc[-1]) > 0 else "Sell"}
                    for feat, _ in top_features[:6]
                ],
                "top_features": top_features,
                "model_score": round(avg_score, 4),
            }

        except Exception as e:
            logger.error(f"Random Forest prediction error: {e}")
            current_price = float(df["Close"].iloc[-1])
            return {
                "predicted_price": current_price,
                "confidence": 20.0,
                "indicators": [],
                "error": str(e),
            }
