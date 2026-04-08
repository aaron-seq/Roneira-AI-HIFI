"""
Technical Analysis Engine
Computes RSI, MACD, Bollinger Bands, Stochastic RSI, ADX, EMA crossovers
and generates aggregate signals.
"""
import logging
import numpy as np
import pandas as pd

logger = logging.getLogger("roneira-ml.technical")


class TechnicalAnalyzer:
    """Pure technical analysis with no ML — rule-based signal engine."""

    def analyze(self, df: pd.DataFrame, horizon_days: int = 30) -> dict:
        """Run full technical analysis on OHLCV DataFrame."""
        try:
            close = df["Close"]
            high = df["High"]
            low = df["Low"]
            volume = df["Volume"]

            indicators = []
            buy_signals = 0
            sell_signals = 0
            total_indicators = 0

            # 1. RSI (14)
            rsi = self._rsi(close, 14)
            rsi_val = float(rsi.iloc[-1])
            rsi_prev = float(rsi.iloc[-2]) if len(rsi) > 1 else rsi_val
            rsi_signal = (
                "Buy"
                if rsi_val < 35 and rsi_val >= rsi_prev
                else ("Sell" if rsi_val > 75 and rsi_val < rsi_prev else "Neutral")
            )
            indicators.append({"name": "RSI (14)", "value": round(rsi_val, 2), "signal": rsi_signal})
            if rsi_signal == "Buy": buy_signals += 1
            elif rsi_signal == "Sell": sell_signals += 1
            total_indicators += 1

            # 2. MACD (12, 26, 9)
            macd, signal_line, histogram = self._macd(close)
            macd_val = float(histogram.iloc[-1])
            macd_signal = "Buy" if macd_val > 0 else ("Sell" if macd_val < 0 else "Neutral")
            indicators.append({"name": "MACD", "value": round(float(macd.iloc[-1]), 4), "signal": macd_signal})
            if macd_signal == "Buy": buy_signals += 1
            elif macd_signal == "Sell": sell_signals += 1
            total_indicators += 1

            # 3. Bollinger Bands (20, 2)
            bb_upper, bb_mid, bb_lower = self._bollinger(close, 20, 2)
            current = float(close.iloc[-1])
            bb_signal = "Buy" if current <= float(bb_lower.iloc[-1]) else (
                "Sell" if current >= float(bb_upper.iloc[-1]) else "Neutral"
            )
            indicators.append({"name": "Bollinger Bands", "value": round(float(bb_mid.iloc[-1]), 2), "signal": bb_signal})
            if bb_signal == "Buy": buy_signals += 1
            elif bb_signal == "Sell": sell_signals += 1
            total_indicators += 1

            # 4. EMA Crossover (20/50)
            ema20 = close.ewm(span=20).mean()
            ema50 = close.ewm(span=50).mean()
            ema_cross = float(ema20.iloc[-1]) > float(ema50.iloc[-1])
            ema_signal = "Buy" if ema_cross else "Sell"
            indicators.append({"name": "EMA 20/50", "value": round(float(ema20.iloc[-1]), 2), "signal": ema_signal})
            if ema_signal == "Buy": buy_signals += 1
            elif ema_signal == "Sell": sell_signals += 1
            total_indicators += 1

            # 5. Stochastic RSI
            stoch_rsi = self._stochastic_rsi(close, 14)
            stoch_val = float(stoch_rsi.iloc[-1])
            stoch_prev = float(stoch_rsi.iloc[-2]) if len(stoch_rsi) > 1 else stoch_val
            stoch_signal = (
                "Buy"
                if stoch_val < 20 and stoch_val >= stoch_prev
                else ("Sell" if stoch_val > 80 and stoch_val < stoch_prev else "Neutral")
            )
            indicators.append({"name": "Stochastic RSI", "value": round(stoch_val, 2), "signal": stoch_signal})
            if stoch_signal == "Buy": buy_signals += 1
            elif stoch_signal == "Sell": sell_signals += 1
            total_indicators += 1

            # 6. ADX (Average Directional Index)
            adx = self._adx(high, low, close, 14)
            adx_val = float(adx.iloc[-1])
            adx_signal = "Buy" if adx_val > 25 and ema_cross else (
                "Sell" if adx_val > 25 and not ema_cross else "Neutral"
            )
            indicators.append({"name": "ADX", "value": round(adx_val, 2), "signal": adx_signal})
            if adx_signal == "Buy": buy_signals += 1
            elif adx_signal == "Sell": sell_signals += 1
            total_indicators += 1

            # Aggregate signal
            signal_ratio = buy_signals / total_indicators if total_indicators > 0 else 0.5
            if signal_ratio >= 0.7:
                overall = "STRONG_BUY"
                score = 8 + signal_ratio * 2
            elif signal_ratio >= 0.5:
                overall = "BUY"
                score = 6 + signal_ratio * 2
            elif signal_ratio >= 0.3:
                overall = "HOLD"
                score = 4 + signal_ratio * 2
            elif signal_ratio >= 0.15:
                overall = "SELL"
                score = 2 + signal_ratio * 2
            else:
                overall = "STRONG_SELL"
                score = signal_ratio * 2

            # Predicted price from TA trend projection
            recent_trend = float(close.pct_change(5).iloc[-1])
            projected_daily = recent_trend / 5
            predicted_price = current * (1 + projected_daily * horizon_days * 0.3)

            confidence = min(85, max(30, 50 + (buy_signals - sell_signals) * 8))

            return {
                "predicted_price": round(predicted_price, 2),
                "confidence": round(confidence, 1),
                "confidence_breakdown": {
                    "technical": round(confidence, 1),
                    "fundamental": round(confidence * 0.6, 1),
                    "sentiment": round(confidence * 0.5, 1),
                    "historical": round(confidence * 0.8, 1),
                },
                "short_term_signal": {"signal": overall, "score": round(min(10, score), 1)},
                "long_term_signal": {"signal": overall, "score": round(min(10, score - 0.5), 1)},
                "indicators": indicators,
                "buy_count": buy_signals,
                "sell_count": sell_signals,
                "neutral_count": total_indicators - buy_signals - sell_signals,
            }

        except Exception as e:
            logger.error(f"Technical analysis error: {e}")
            return {
                "predicted_price": float(df["Close"].iloc[-1]),
                "confidence": 25.0,
                "indicators": [],
            }

    def _rsi(self, series: pd.Series, period: int = 14) -> pd.Series:
        delta = series.diff()
        gain = delta.where(delta > 0, 0).rolling(period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(period).mean()
        rs = gain / loss.replace(0, np.nan)
        return 100 - (100 / (1 + rs))

    def _macd(self, series: pd.Series, fast=12, slow=26, signal_period=9):
        ema_fast = series.ewm(span=fast).mean()
        ema_slow = series.ewm(span=slow).mean()
        macd = ema_fast - ema_slow
        signal = macd.ewm(span=signal_period).mean()
        histogram = macd - signal
        return macd, signal, histogram

    def _bollinger(self, series: pd.Series, period=20, std_dev=2):
        mid = series.rolling(period).mean()
        std = series.rolling(period).std()
        upper = mid + std_dev * std
        lower = mid - std_dev * std
        return upper, mid, lower

    def _stochastic_rsi(self, series: pd.Series, period=14) -> pd.Series:
        rsi = self._rsi(series, period)
        stoch = ((rsi - rsi.rolling(period).min()) / (rsi.rolling(period).max() - rsi.rolling(period).min())) * 100
        return stoch

    def _adx(self, high: pd.Series, low: pd.Series, close: pd.Series, period=14) -> pd.Series:
        plus_dm = high.diff()
        minus_dm = (-low.diff())
        plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0)
        minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0)

        tr = pd.concat([
            high - low,
            (high - close.shift()).abs(),
            (low - close.shift()).abs(),
        ], axis=1).max(axis=1)

        atr = tr.rolling(period).mean()
        plus_di = 100 * (plus_dm.rolling(period).mean() / atr)
        minus_di = 100 * (minus_dm.rolling(period).mean() / atr)

        dx = (abs(plus_di - minus_di) / (plus_di + minus_di)) * 100
        adx = dx.rolling(period).mean()
        return adx
