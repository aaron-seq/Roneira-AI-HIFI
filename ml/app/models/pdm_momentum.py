"""
Price-Volume-Derivatives (PVD) Momentum Engine
Ported from the original Roneira AI HIFI PDM Strategy Engine.
Analyzes price action, volume patterns, and derivative signals
to generate momentum-based predictions.
"""
import logging
import numpy as np
import pandas as pd

logger = logging.getLogger("roneira-ml.pdm_momentum")


class PVDMomentumEngine:
    """PVD Momentum Strategy — proprietary momentum analysis."""

    def __init__(self):
        self.lookback_short = 5
        self.lookback_medium = 20
        self.lookback_long = 50
        logger.info("PVD Momentum Engine initialized")

    def analyze(self, df: pd.DataFrame, ticker: str, horizon_days: int = 30) -> dict:
        """Full PVD momentum analysis."""
        try:
            close = df["Close"]
            volume = df["Volume"]
            high = df["High"]
            low = df["Low"]

            # 1. Price Momentum
            price_momentum = self._compute_price_momentum(close)

            # 2. Volume Analysis
            volume_signal = self._compute_volume_signal(close, volume)

            # 3. Derivative (Rate of Change) Analysis
            derivative_signal = self._compute_derivative_signal(close)

            # 4. Support/Resistance
            support, resistance = self._compute_support_resistance(high, low, close)

            # 5. Trend Strength
            trend_strength = self._compute_trend_strength(close)

            # 6. Momentum Divergence
            momentum_div = self._compute_momentum_divergence(close, volume)

            # Combine signals
            signals = [price_momentum, volume_signal, derivative_signal, trend_strength]
            avg_signal = np.mean(signals)

            # Map to signal label
            if avg_signal >= 0.6:
                signal_label = "STRONG_BUY"
                signal_score = 8 + avg_signal * 2
            elif avg_signal >= 0.3:
                signal_label = "BUY"
                signal_score = 6 + avg_signal * 2
            elif avg_signal >= -0.3:
                signal_label = "HOLD"
                signal_score = 4 + avg_signal * 2
            elif avg_signal >= -0.6:
                signal_label = "SELL"
                signal_score = 2 + avg_signal * 2
            else:
                signal_label = "STRONG_SELL"
                signal_score = max(0, avg_signal * 2)

            # Price projection
            current_price = float(close.iloc[-1])
            momentum_factor = avg_signal * 0.03 * (horizon_days / 30)
            predicted_price = current_price * (1 + momentum_factor)

            # Confidence
            consistency = 1 - np.std(signals)
            confidence = min(80, max(25, 50 + consistency * 30 + abs(avg_signal) * 15))

            indicators = [
                {"name": "Price Momentum", "value": round(price_momentum, 4), "signal": "Buy" if price_momentum > 0 else "Sell"},
                {"name": "Volume Signal", "value": round(volume_signal, 4), "signal": "Buy" if volume_signal > 0 else "Sell"},
                {"name": "Rate of Change", "value": round(derivative_signal, 4), "signal": "Buy" if derivative_signal > 0 else "Sell"},
                {"name": "Trend Strength", "value": round(trend_strength, 4), "signal": "Buy" if trend_strength > 0 else "Neutral"},
                {"name": "Support Level", "value": round(support, 2), "signal": "Buy" if current_price > support else "Neutral"},
                {"name": "Resistance Level", "value": round(resistance, 2), "signal": "Sell" if current_price > resistance * 0.98 else "Neutral"},
            ]

            return {
                "predicted_price": round(predicted_price, 2),
                "confidence": round(confidence, 1),
                "confidence_breakdown": {
                    "technical": round(confidence * 1.05, 1),
                    "fundamental": round(confidence * 0.6, 1),
                    "sentiment": round(confidence * 0.5, 1),
                    "historical": round(confidence * 0.9, 1),
                },
                "short_term_signal": {"signal": signal_label, "score": round(min(10, signal_score), 1)},
                "long_term_signal": {"signal": signal_label, "score": round(min(10, signal_score - 1), 1)},
                "indicators": indicators,
                "momentum_divergence": round(momentum_div, 4),
                "support": round(support, 2),
                "resistance": round(resistance, 2),
            }

        except Exception as e:
            logger.error(f"PVD Momentum analysis error: {e}")
            return {
                "predicted_price": float(df["Close"].iloc[-1]),
                "confidence": 20.0,
                "indicators": [],
            }

    def _compute_price_momentum(self, close: pd.Series) -> float:
        """Multi-timeframe price momentum."""
        r5 = float(close.pct_change(self.lookback_short).iloc[-1])
        r20 = float(close.pct_change(self.lookback_medium).iloc[-1])
        r50 = float(close.pct_change(self.lookback_long).iloc[-1])
        weighted = r5 * 0.5 + r20 * 0.3 + r50 * 0.2
        return np.clip(weighted * 10, -1, 1)

    def _compute_volume_signal(self, close: pd.Series, volume: pd.Series) -> float:
        """Volume-price confirmation signal."""
        avg_vol = float(volume.rolling(20).mean().iloc[-1])
        current_vol = float(volume.iloc[-1])
        vol_ratio = current_vol / avg_vol if avg_vol > 0 else 1

        price_direction = 1 if float(close.iloc[-1]) > float(close.iloc[-2]) else -1
        # High volume with price direction = strong signal
        if vol_ratio > 1.5:
            return price_direction * 0.8
        elif vol_ratio > 1.0:
            return price_direction * 0.4
        else:
            return price_direction * 0.1

    def _compute_derivative_signal(self, close: pd.Series) -> float:
        """Rate of change (first derivative) analysis."""
        roc5 = float(close.pct_change(5).iloc[-1])
        roc10 = float(close.pct_change(10).iloc[-1])

        # Acceleration (second derivative)
        roc_series = close.pct_change(5)
        acceleration = float(roc_series.diff().iloc[-1])

        signal = (roc5 * 0.5 + roc10 * 0.3 + acceleration * 100 * 0.2)
        return np.clip(signal * 10, -1, 1)

    def _compute_support_resistance(self, high: pd.Series, low: pd.Series, close: pd.Series) -> tuple:
        """Calculate support and resistance levels."""
        recent = close.tail(min(50, len(close)))
        support = float(recent.min())
        resistance = float(recent.max())
        return support, resistance

    def _compute_trend_strength(self, close: pd.Series) -> float:
        """ADX-like trend strength measurement."""
        sma20 = close.rolling(20).mean()
        sma50 = close.rolling(50).mean()

        above_sma20 = float(close.iloc[-1]) > float(sma20.iloc[-1])
        above_sma50 = float(close.iloc[-1]) > float(sma50.iloc[-1])
        sma20_above_50 = float(sma20.iloc[-1]) > float(sma50.iloc[-1])

        score = 0
        if above_sma20: score += 0.35
        if above_sma50: score += 0.35
        if sma20_above_50: score += 0.3

        return score * 2 - 1  # Map to [-1, 1]

    def _compute_momentum_divergence(self, close: pd.Series, volume: pd.Series) -> float:
        """Detect divergence between price and volume momentum."""
        price_mom = float(close.pct_change(10).iloc[-1])
        vol_mom = float(volume.pct_change(10).iloc[-1])

        # Divergence: price up + volume down = bearish divergence
        if price_mom > 0 and vol_mom < -0.1:
            return -0.5  # Bearish divergence
        elif price_mom < 0 and vol_mom > 0.1:
            return 0.5  # Bullish divergence
        return 0.0
