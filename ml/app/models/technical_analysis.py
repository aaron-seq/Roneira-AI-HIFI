"""
Technical Analysis Engine
Computes RSI, MACD, Bollinger Bands, Stochastic RSI, ADX, EMA crossovers,
Supertrend, Ichimoku Cloud and Anchored VWAP, and generates aggregate signals.

Every indicator votes Buy / Sell / Neutral and the verdict is the *net* vote
(see `analyze`). An indicator that cannot be computed from the data on hand --
Ichimoku needs 52 sessions, Anchored VWAP needs non-zero volume -- votes
Neutral rather than raising, so a short frame degrades conviction instead of
losing the whole analysis to the exception handler.
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

            indicators: list[dict] = []

            # 1. RSI (14)
            rsi = self._rsi(close, 14)
            rsi_val = self._last(rsi)
            rsi_prev = float(rsi.iloc[-2]) if len(rsi) > 1 and np.isfinite(rsi.iloc[-2]) else rsi_val
            rsi_signal = (
                "Buy"
                if rsi_val < 35 and rsi_val >= rsi_prev
                else ("Sell" if rsi_val > 75 and rsi_val < rsi_prev else "Neutral")
            )
            indicators.append({"name": "RSI (14)", "value": round(rsi_val, 2), "signal": rsi_signal})

            # 2. MACD (12, 26, 9)
            macd, _, histogram = self._macd(close)
            macd_val = self._last(histogram)
            macd_signal = "Buy" if macd_val > 0 else ("Sell" if macd_val < 0 else "Neutral")
            indicators.append({"name": "MACD", "value": round(self._last(macd), 4), "signal": macd_signal})

            # 3. Bollinger Bands (20, 2)
            bb_upper, bb_mid, bb_lower = self._bollinger(close, 20, 2)
            current = float(close.iloc[-1])
            bb_signal = "Buy" if current <= self._last(bb_lower) else (
                "Sell" if current >= self._last(bb_upper) else "Neutral"
            )
            indicators.append({"name": "Bollinger Bands", "value": round(self._last(bb_mid), 2), "signal": bb_signal})

            # 4. EMA Crossover (20/50)
            ema20 = close.ewm(span=20).mean()
            ema50 = close.ewm(span=50).mean()
            ema_cross = float(ema20.iloc[-1]) > float(ema50.iloc[-1])
            ema_signal = "Buy" if ema_cross else "Sell"
            indicators.append({"name": "EMA 20/50", "value": round(float(ema20.iloc[-1]), 2), "signal": ema_signal})

            # 5. Stochastic RSI
            stoch_rsi = self._stochastic_rsi(close, 14)
            stoch_val = self._last(stoch_rsi, default=50.0)
            stoch_prev = (
                float(stoch_rsi.iloc[-2])
                if len(stoch_rsi) > 1 and np.isfinite(stoch_rsi.iloc[-2])
                else stoch_val
            )
            stoch_signal = (
                "Buy"
                if stoch_val < 20 and stoch_val >= stoch_prev
                else ("Sell" if stoch_val > 80 and stoch_val < stoch_prev else "Neutral")
            )
            indicators.append({"name": "Stochastic RSI", "value": round(stoch_val, 2), "signal": stoch_signal})

            # 6. ADX (Average Directional Index)
            adx = self._adx(high, low, close, 14)
            adx_val = self._last(adx)
            adx_signal = "Buy" if adx_val > 25 and ema_cross else (
                "Sell" if adx_val > 25 and not ema_cross else "Neutral"
            )
            indicators.append({"name": "ADX", "value": round(adx_val, 2), "signal": adx_signal})

            # 7. Supertrend (10, 3) -- an ATR-banded trailing stop. Which side of
            # it price is on IS the signal; that is the whole point of it.
            supertrend, st_direction = self._supertrend(high, low, close, 10, 3.0)
            st_val = self._last(supertrend, default=current)
            st_dir = int(st_direction.iloc[-1]) if len(st_direction) else 0
            st_signal = "Buy" if st_dir > 0 else ("Sell" if st_dir < 0 else "Neutral")
            indicators.append({"name": "Supertrend (10,3)", "value": round(st_val, 2), "signal": st_signal})

            # 8. Ichimoku Cloud -- price clear of the cloud *and* tenkan/kijun
            # agreeing. Either alone is the weaker read, so both are required.
            tenkan, kijun, span_a, span_b = self._ichimoku(high, low, close)
            span_a_val = self._last(span_a, default=float("nan"))
            span_b_val = self._last(span_b, default=float("nan"))
            tk_val = self._last(tenkan, default=float("nan"))
            kj_val = self._last(kijun, default=float("nan"))
            if not np.isfinite([span_a_val, span_b_val, tk_val, kj_val]).all():
                ichimoku_signal = "Neutral"
            elif current > max(span_a_val, span_b_val) and tk_val > kj_val:
                ichimoku_signal = "Buy"
            elif current < min(span_a_val, span_b_val) and tk_val < kj_val:
                ichimoku_signal = "Sell"
            else:
                ichimoku_signal = "Neutral"
            indicators.append({
                "name": "Ichimoku Cloud",
                "value": round(float(kj_val), 2) if np.isfinite(kj_val) else 0.0,
                "signal": ichimoku_signal,
            })

            # 9. Anchored VWAP -- anchored at both the highest high and the lowest
            # low of the lookback, the two anchors that actually get drawn. Above
            # both is participation-weighted strength; below both, weakness.
            avwap_high, avwap_low = self._anchored_vwap(high, low, close, volume)
            if avwap_high is None or avwap_low is None:
                avwap_signal, avwap_value = "Neutral", 0.0
            else:
                avwap_value = avwap_low
                if current > avwap_high and current > avwap_low:
                    avwap_signal = "Buy"
                elif current < avwap_high and current < avwap_low:
                    avwap_signal = "Sell"
                else:
                    avwap_signal = "Neutral"
            indicators.append({
                "name": "Anchored VWAP",
                "value": round(float(avwap_value), 2),
                "signal": avwap_signal,
            })

            # ---- Aggregate ----
            # Net vote, not buy-share. `buy / total` counted every Neutral as
            # evidence against buying, so a flat tape with one buy and one sell
            # among four abstentions scored 0.167 and was reported as SELL, while
            # a 2-2 split scored 0.333 and was reported as HOLD. Neutral now means
            # neutral, and abstentions reduce conviction instead of supplying
            # direction: net runs -1 (unanimous sell) to +1 (unanimous buy) and
            # sits at 0 both when nobody votes and when the votes cancel.
            buy_signals = sum(1 for ind in indicators if ind["signal"] == "Buy")
            sell_signals = sum(1 for ind in indicators if ind["signal"] == "Sell")
            total_indicators = len(indicators)
            net, overall, score = self._aggregate(
                buy_signals, sell_signals, total_indicators
            )

            # Predicted price from TA trend projection
            recent_trend = float(close.pct_change(5).iloc[-1])
            projected_daily = recent_trend / 5
            predicted_price = current * (1 + projected_daily * horizon_days * 0.3)

            # Keyed off `net`, not the raw vote difference. `(buy - sell) * 8`
            # saturated the 85 ceiling at a 5-vote margin, so going from 6
            # indicators to 9 would have quietly made every read more confident
            # without any new agreement behind it. As a fraction it stays
            # proportional whatever the basket size.
            confidence = min(85.0, max(30.0, 50.0 + net * 35.0))

            return {
                "predicted_price": round(predicted_price, 2),
                "confidence": round(confidence, 1),
                "confidence_breakdown": {
                    "technical": round(confidence, 1),
                    "fundamental": round(confidence * 0.6, 1),
                    "sentiment": round(confidence * 0.5, 1),
                    "historical": round(confidence * 0.8, 1),
                },
                "short_term_signal": {"signal": overall, "score": round(score, 1)},
                "long_term_signal": {"signal": overall, "score": round(max(0.0, score - 0.5), 1)},
                "indicators": indicators,
                "buy_count": buy_signals,
                "sell_count": sell_signals,
                "neutral_count": total_indicators - buy_signals - sell_signals,
                "net_vote": round(net, 3),
            }

        except Exception as e:
            logger.error(f"Technical analysis error: {e}")
            return {
                "predicted_price": float(df["Close"].iloc[-1]),
                "confidence": 25.0,
                "indicators": [],
            }

    @staticmethod
    def _aggregate(buy: int, sell: int, total: int) -> tuple[float, str, float]:
        """
        Turn the vote tally into (net, label, score).

        Net vote, not buy-share. The previous `buy / total` counted every
        abstention as evidence against buying and never used `sell` at all, so
        Neutral was structurally bearish: nine abstentions -- no information
        whatsoever -- scored 0.0 and came out STRONG_SELL, and a single buy
        against eight abstentions came out STRONG_SELL too, despite a positive
        net vote. Here net runs -1 (unanimous sell) to +1 (unanimous buy) and
        sits at 0 both when nobody votes and when the votes cancel.

        Score is 0-10 with 5.0 as "no opinion", so it can never point the
        opposite way to the label.
        """
        net = (buy - sell) / total if total else 0.0

        if net >= 0.5:
            label = "STRONG_BUY"
        elif net >= 0.2:
            label = "BUY"
        elif net > -0.2:
            label = "HOLD"
        elif net > -0.5:
            label = "SELL"
        else:
            label = "STRONG_SELL"

        return net, label, min(10.0, max(0.0, 5.0 + net * 5.0))

    @staticmethod
    def _last(series: pd.Series, default: float = 0.0) -> float:
        """
        Last finite value, or `default`.

        Every indicator here is a rolling window, so the first `period` rows are
        NaN by construction and a frame shorter than the window is *all* NaN.
        Reading `.iloc[-1]` blind put a NaN into the comparison chain, which is
        False against everything and quietly biased the vote.
        """
        if len(series) == 0:
            return default
        value = float(series.iloc[-1])
        return value if np.isfinite(value) else default

    def _atr(self, high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
        """True range, Wilder-smoothed. Shared by ADX and Supertrend."""
        tr = pd.concat([
            high - low,
            (high - close.shift()).abs(),
            (low - close.shift()).abs(),
        ], axis=1).max(axis=1)
        return tr.rolling(period).mean()

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

    def _supertrend(
        self,
        high: pd.Series,
        low: pd.Series,
        close: pd.Series,
        period: int = 10,
        multiplier: float = 3.0,
    ) -> tuple[pd.Series, pd.Series]:
        """
        Supertrend: an ATR band that ratchets in the direction of the trend and
        flips when price closes through it.

        Returns (band, direction) where direction is +1 in an uptrend, -1 in a
        downtrend, 0 while ATR is still warming up. The bands are path-dependent
        -- each one can only tighten until a flip resets it -- so this is a loop
        rather than a vectorised expression.
        """
        atr = self._atr(high, low, close, period)
        hl2 = (high + low) / 2
        upper_basic = (hl2 + multiplier * atr).values
        lower_basic = (hl2 - multiplier * atr).values
        closes = close.values

        n = len(closes)
        upper = np.full(n, np.nan)
        lower = np.full(n, np.nan)
        direction = np.zeros(n, dtype=int)
        band = np.full(n, np.nan)

        started = False
        for i in range(n):
            if not np.isfinite(upper_basic[i]) or not np.isfinite(lower_basic[i]):
                continue

            if not started:
                # First bar with a usable ATR: seed the bands and assume the
                # trend matches where price sits relative to the midpoint.
                upper[i], lower[i] = upper_basic[i], lower_basic[i]
                direction[i] = 1 if closes[i] >= hl2.values[i] else -1
                band[i] = lower[i] if direction[i] > 0 else upper[i]
                started = True
                continue

            prev = i - 1
            # Ratchet: the upper band only falls while price stays under it, the
            # lower band only rises while price stays above it.
            upper[i] = (
                min(upper_basic[i], upper[prev])
                if closes[prev] <= upper[prev]
                else upper_basic[i]
            )
            lower[i] = (
                max(lower_basic[i], lower[prev])
                if closes[prev] >= lower[prev]
                else lower_basic[i]
            )

            if closes[i] > upper[prev]:
                direction[i] = 1
            elif closes[i] < lower[prev]:
                direction[i] = -1
            else:
                direction[i] = direction[prev]

            band[i] = lower[i] if direction[i] > 0 else upper[i]

        return (
            pd.Series(band, index=close.index),
            pd.Series(direction, index=close.index),
        )

    def _ichimoku(
        self,
        high: pd.Series,
        low: pd.Series,
        close: pd.Series,
        conversion: int = 9,
        base: int = 26,
        span_b_period: int = 52,
    ) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series]:
        """
        Ichimoku Kinko Hyo: tenkan-sen, kijun-sen, senkou span A and span B.

        The two spans are shifted forward by `base`, which is what makes the
        cloud sitting under today's price a projection of data from 26 sessions
        ago. Reading `.iloc[-1]` off the shifted series therefore stays causal --
        it is the cloud plotted at today's bar, not a peek at the future.

        The chikou span (close shifted *back* 26) is deliberately not returned:
        it can only be read against price 26 bars ago, so it says nothing about
        the current bar and would tempt a look-ahead comparison.
        """
        def midpoint(window: int) -> pd.Series:
            return (high.rolling(window).max() + low.rolling(window).min()) / 2

        tenkan = midpoint(conversion)
        kijun = midpoint(base)
        span_a = ((tenkan + kijun) / 2).shift(base)
        span_b = midpoint(span_b_period).shift(base)
        return tenkan, kijun, span_a, span_b

    def _anchored_vwap(
        self,
        high: pd.Series,
        low: pd.Series,
        close: pd.Series,
        volume: pd.Series,
        lookback: int = 252,
    ) -> tuple[float | None, float | None]:
        """
        VWAP anchored at the highest high and at the lowest low of the lookback.

        Those are the two anchors traders actually draw: the swing high (where
        trapped buyers sit) and the swing low (where the move began). Returns
        (from_high, from_low), or (None, None) when the anchored segment has no
        volume to weight by -- index tickers like ^NSEI report Volume 0, and an
        unweighted average dressed up as a VWAP would be a lie.
        """
        n = len(close)
        if n == 0:
            return None, None

        window = min(lookback, n)
        start = n - window
        highs = high.values[start:]
        lows = low.values[start:]
        if not np.isfinite(highs).any() or not np.isfinite(lows).any():
            return None, None

        typical = ((high + low + close) / 3).values
        volumes = volume.values.astype(float)

        def vwap_from(anchor: int) -> float | None:
            weights = volumes[anchor:]
            prices = typical[anchor:]
            keep = np.isfinite(weights) & np.isfinite(prices)
            total = weights[keep].sum()
            if total <= 0:
                return None
            return float((prices[keep] * weights[keep]).sum() / total)

        high_anchor = start + int(np.nanargmax(highs))
        low_anchor = start + int(np.nanargmin(lows))
        return vwap_from(high_anchor), vwap_from(low_anchor)
