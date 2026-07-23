"""Price-Volume Derivatives Momentum Strategy (PDM) Engine

A calculus-driven framework for capturing institutional momentum
in Indian equities. Implements the PDM strategy using mathematical
derivatives of price and volume.

Author: Aaron Sequeira
Company: Roneira AI
"""

import os
import numpy as np
import pandas as pd
from typing import Dict, List, Optional
import yfinance as yf
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
from dataclasses import dataclass
import warnings

warnings.filterwarnings("ignore")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class PDMSignal:
    """Data class to represent PDM trading signal"""

    symbol: str
    signal_type: str  # 'LONG', 'EXIT', 'HOLD'
    price: float
    timestamp: datetime
    price_velocity: float
    price_curvature: float
    volume_sensitivity: float
    atr_stop_loss: float
    trailing_stop: float
    confidence_score: float
    institutional_volume_factor: float
    position_size_shares: int = 0


class PriceVolumeDerivativesEngine:
    """Core engine implementing PDM strategy using calculus-based momentum detection"""

    def __init__(
        self,
        lookback_period: int = 252,
        min_liquidity: float = 1_000_000,
        max_workers: int = 8,
        max_scan_candidates: Optional[int] = None,
    ):
        """
        Initialize PDM Strategy Engine

        Args:
            lookback_period: Number of days for historical analysis
            min_liquidity: Minimum daily volume threshold for stock selection
            max_workers: Max concurrent threads used to fetch market data
            max_scan_candidates: Optional cap on how many liquidity-filtered
                symbols are scanned for signals per run. Defaults to the
                full universe (no artificial limit). Configurable via the
                PDM_MAX_SCAN_CANDIDATES env var for operators who want to
                bound scan latency without editing code.
        """
        self.lookback_period = lookback_period
        self.minimum_daily_liquidity = min_liquidity
        self.max_workers = max_workers
        self.maximum_positions = 25
        self.atr_hard_stop_multiplier = 2.0
        self.atr_trailing_stop_multiplier = 3.0
        self.indian_market_symbols = self._get_nifty_500_universe()

        env_cap = os.getenv("PDM_MAX_SCAN_CANDIDATES")
        self.max_scan_candidates = (
            max_scan_candidates
            if max_scan_candidates is not None
            else (int(env_cap) if env_cap else len(self.indian_market_symbols))
        )

    def _get_nifty_500_universe(self) -> List[str]:
        """Get dynamic NIFTY 500 stock universe with .NS suffix for Indian stocks"""
        # Sample of high-liquidity Indian stocks - in production, this would be dynamic
        sample_universe = [
            "RELIANCE.NS",
            "TCS.NS",
            "HDFCBANK.NS",
            "INFY.NS",
            "HINDUNILVR.NS",
            "ITC.NS",
            "SBIN.NS",
            "BHARTIARTL.NS",
            "ASIANPAINT.NS",
            "MARUTI.NS",
            "KOTAKBANK.NS",
            "LT.NS",
            "AXISBANK.NS",
            "NESTLEIND.NS",
            "WIPRO.NS",
            "ULTRACEMCO.NS",
            "BAJFINANCE.NS",
            "HCLTECH.NS",
            "SUNPHARMA.NS",
            "ONGC.NS",
        ]
        return sample_universe

    def _fetch_history(self, symbol: str, days: int) -> Optional[pd.DataFrame]:
        """
        Fetch a single symbol's OHLCV history once. Callers that need both a
        short liquidity window and the full lookback window should fetch the
        full window and slice it, rather than issuing a second download -
        avoids the redundant-fetch problem where the same data was
        previously downloaded twice (once for liquidity filtering, again for
        signal generation).
        """
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            data = yf.download(
                symbol, start=start_date, end=end_date, progress=False, threads=False
            )

            if data.empty:
                return None

            # Basic data-quality validation. Close and Volume are mandatory
            # (needed for both liquidity filtering and signal generation);
            # signal generation additionally uses Open/High/Low when present.
            # Reject symbols whose essential data is mostly gaps rather than
            # silently proceeding with NaN-riddled calculations.
            essential_columns = ["Close", "Volume"]
            missing_essential = [c for c in essential_columns if c not in data.columns]
            if missing_essential:
                logger.warning(f"{symbol}: missing essential columns {missing_essential}")
                return None

            clean_data = data.dropna(subset=essential_columns)
            if len(clean_data) < 0.5 * len(data):
                logger.warning(
                    f"{symbol}: dropped >50% of rows as NaN ({len(data) - len(clean_data)}/{len(data)}); skipping"
                )
                return None

            return clean_data
        except Exception as e:
            logger.warning(f"Could not fetch data for {symbol}: {e}")
            return None

    def fetch_universe_data(self, symbols: List[str], days: int) -> Dict[str, pd.DataFrame]:
        """
        Fetch OHLCV history for many symbols concurrently. yfinance calls are
        I/O-bound (network requests), so a thread pool gives a large wall-clock
        speedup over sequential fetching without the complexity of an async
        rewrite of the whole engine.
        """
        results: Dict[str, pd.DataFrame] = {}

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_symbol = {
                executor.submit(self._fetch_history, symbol, days): symbol for symbol in symbols
            }
            for future in as_completed(future_to_symbol):
                symbol = future_to_symbol[future]
                data = future.result()
                if data is not None:
                    results[symbol] = data

        return results

    def filter_stocks_by_liquidity(
        self, symbols: List[str], universe_data: Optional[Dict[str, pd.DataFrame]] = None
    ) -> List[str]:
        """
        Filter stocks based on daily liquidity requirements.

        Args:
            symbols: List of stock symbols to filter
            universe_data: Optional pre-fetched {symbol: OHLCV DataFrame} map
                (as returned by fetch_universe_data) covering at least the
                last 30 days. When provided, no additional network calls are
                made - this is what lets scan_universe_for_opportunities
                fetch each symbol's data exactly once.

        Returns:
            List of symbols meeting liquidity criteria
        """
        liquid_stocks = []

        for symbol in symbols:
            # Use pre-fetched data when available (scan path, fetched
            # concurrently upstream); otherwise fetch this symbol on demand.
            if universe_data is not None:
                stock_data = universe_data.get(symbol)
            else:
                stock_data = self._fetch_history(symbol, 30)

            if stock_data is None or stock_data.empty:
                continue

            recent_window = stock_data.tail(30)
            average_daily_volume = recent_window["Volume"].mean()
            average_price = recent_window["Close"].mean()
            daily_liquidity = average_daily_volume * average_price

            if daily_liquidity >= self.minimum_daily_liquidity:
                liquid_stocks.append(symbol)
                logger.info(f"{symbol}: Daily liquidity {daily_liquidity:,.0f}")

        logger.info(
            f"Filtered {len(liquid_stocks)} stocks from {len(symbols)} based on liquidity"
        )
        return liquid_stocks

    def calculate_price_velocity(self, price_series: pd.Series) -> pd.Series:
        """
        Calculate price velocity (df/dt) - first derivative of price with respect to time

        Args:
            price_series: Time series of stock prices

        Returns:
            Series containing price velocity values
        """
        return price_series.diff() / 1  # Daily velocity (price change per day)

    def calculate_price_curvature(self, price_series: pd.Series) -> pd.Series:
        """
        Calculate price curvature (d²f/dt²) - second derivative showing acceleration/deceleration

        Args:
            price_series: Time series of stock prices

        Returns:
            Series containing price curvature values
        """
        velocity = self.calculate_price_velocity(price_series)
        return velocity.diff() / 1  # Daily acceleration

    def calculate_volume_sensitivity(
        self, price_series: pd.Series, volume_series: pd.Series
    ) -> pd.Series:
        """
        Calculate volume sensitivity (df/dV) - price responsiveness to volume changes

        Args:
            price_series: Time series of stock prices
            volume_series: Time series of volume data

        Returns:
            Series containing volume sensitivity values
        """
        price_change = price_series.diff()
        volume_change = volume_series.diff()

        # np.where avoids amplifying near-zero denominators into huge/unstable
        # ratios the way `+ 1e-10` alone can; only compute the ratio where the
        # denominator is meaningfully non-zero, else report 0 sensitivity.
        safe_volume_change = volume_change.where(volume_change.abs() > 1e-6, other=np.nan)
        volume_sensitivity = price_change / safe_volume_change
        return volume_sensitivity.replace([np.inf, -np.inf], np.nan).fillna(0)

    def calculate_moving_averages(
        self, price_series: pd.Series
    ) -> Dict[str, pd.Series]:
        """
        Calculate required moving averages for trend confirmation

        Args:
            price_series: Time series of stock prices

        Returns:
            Dictionary containing different moving averages
        """
        return {
            "sma_20": price_series.rolling(window=20).mean(),
            "sma_200": price_series.rolling(window=200).mean(),
        }

    def calculate_average_true_range(
        self,
        high_series: pd.Series,
        low_series: pd.Series,
        close_series: pd.Series,
        period: int = 14,
    ) -> pd.Series:
        """
        Calculate Average True Range (ATR) for volatility-adjusted stops

        Args:
            high_series: High prices
            low_series: Low prices
            close_series: Close prices
            period: ATR calculation period

        Returns:
            Series containing ATR values
        """
        true_range_1 = high_series - low_series
        true_range_2 = abs(high_series - close_series.shift(1))
        true_range_3 = abs(low_series - close_series.shift(1))

        true_range = pd.concat([true_range_1, true_range_2, true_range_3], axis=1).max(
            axis=1
        )
        atr = true_range.rolling(window=period).mean()

        return atr

    def detect_institutional_volume_participation(
        self, volume_series: pd.Series, price_series: pd.Series
    ) -> pd.Series:
        """
        Detect institutional volume participation using volume profile analysis

        Args:
            volume_series: Volume time series
            price_series: Price time series

        Returns:
            Series indicating institutional participation factor
        """
        volume_ma_20 = volume_series.rolling(window=20).mean()
        volume_ratio = volume_series / volume_ma_20

        # Price-volume correlation for institutional detection
        price_change = price_series.pct_change()
        volume_change = volume_series.pct_change()

        correlation_window = 10
        price_volume_correlation = price_change.rolling(window=correlation_window).corr(
            volume_change
        )

        # Institutional factor combines volume surge with price-volume correlation
        institutional_factor = volume_ratio * abs(price_volume_correlation.fillna(0))

        return institutional_factor.fillna(0)

    def calculate_position_size(
        self, account_equity: float, entry_price: float, atr: float, risk_per_trade_pct: float = 0.01
    ) -> int:
        """
        Volatility-adjusted position sizing: risk a fixed fraction of equity
        per trade, sized so that a hit of the ATR-based hard stop loses
        approximately `risk_per_trade_pct` of the account - replacing the
        previous behaviour of using the same static ATR multipliers for
        every stock with no position-sizing step at all.

        Args:
            account_equity: Total capital allocated to the strategy
            entry_price: Planned entry price
            atr: Current Average True Range for the symbol
            risk_per_trade_pct: Fraction of equity to risk per trade (default 1%)

        Returns:
            Number of shares to buy (0 if inputs are invalid)
        """
        if account_equity <= 0 or entry_price <= 0 or atr <= 0:
            return 0

        risk_amount = account_equity * risk_per_trade_pct
        stop_distance = atr * self.atr_hard_stop_multiplier
        if stop_distance <= 0:
            return 0

        shares_by_risk = risk_amount / stop_distance
        # Cap position value at a sane fraction of equity too, in case ATR is
        # unusually small relative to price (e.g. very low-volatility stock).
        max_shares_by_capital = (account_equity * 0.20) / entry_price

        return max(0, int(min(shares_by_risk, max_shares_by_capital)))

    def generate_pdm_signals(
        self, symbol: str, stock_data: Optional[pd.DataFrame] = None
    ) -> Optional[PDMSignal]:
        """
        Generate PDM trading signals for a given stock symbol

        Args:
            symbol: Stock symbol to analyze
            stock_data: Optional pre-fetched OHLCV DataFrame covering at
                least `lookback_period` days. When omitted, data is fetched
                here (kept for backward-compatible standalone use); scans
                should pass pre-fetched data to avoid a redundant download.

        Returns:
            PDMSignal object if signal generated, None otherwise
        """
        try:
            if stock_data is None:
                stock_data = self._fetch_history(symbol, self.lookback_period + 50)

            if stock_data is None or stock_data.empty or len(stock_data) < 200:
                logger.warning(
                    f"Insufficient data for {symbol} "
                    f"({0 if stock_data is None else len(stock_data)} rows, need >= 200)"
                )
                return None

            # Calculate PDM indicators
            price_velocity = self.calculate_price_velocity(stock_data["Close"])
            price_curvature = self.calculate_price_curvature(stock_data["Close"])
            volume_sensitivity = self.calculate_volume_sensitivity(
                stock_data["Close"], stock_data["Volume"]
            )

            # Calculate moving averages
            moving_averages = self.calculate_moving_averages(stock_data["Close"])

            # Calculate ATR for risk management
            atr = self.calculate_average_true_range(
                stock_data["High"], stock_data["Low"], stock_data["Close"]
            )

            # Detect institutional participation
            institutional_factor = self.detect_institutional_volume_participation(
                stock_data["Volume"], stock_data["Close"]
            )

            # Get latest values
            latest_price = float(stock_data["Close"].iloc[-1])
            latest_velocity = float(price_velocity.iloc[-1])
            latest_curvature = float(price_curvature.iloc[-1])
            latest_volume_sensitivity = float(volume_sensitivity.iloc[-1])
            latest_atr = float(atr.iloc[-1]) if not np.isnan(atr.iloc[-1]) else 0.0
            latest_institutional_factor = float(institutional_factor.iloc[-1])
            latest_sma_20 = float(moving_averages["sma_20"].iloc[-1])
            latest_sma_200 = float(moving_averages["sma_200"].iloc[-1])

            if any(np.isnan(v) for v in (latest_price, latest_velocity, latest_sma_20, latest_sma_200)):
                logger.warning(f"{symbol}: NaN in latest indicator values, skipping")
                return None

            confidence_score = self._compute_confidence_score(
                latest_sma_20,
                latest_sma_200,
                latest_price,
                latest_velocity,
                latest_curvature,
                latest_institutional_factor,
            )

            trend_confirmation = latest_sma_20 > latest_sma_200 and latest_price > latest_sma_20
            positive_velocity = latest_velocity > 0
            early_impulse = latest_curvature < 0  # Momentum peak capture
            volume_validation = latest_institutional_factor > 1.2

            signal_type = "HOLD"
            if (
                trend_confirmation
                and positive_velocity
                and early_impulse
                and volume_validation
                and confidence_score > 0.7
            ):
                signal_type = "LONG"

            hard_stop_loss = latest_price - (latest_atr * self.atr_hard_stop_multiplier)
            trailing_stop = latest_price - (latest_atr * self.atr_trailing_stop_multiplier)

            return PDMSignal(
                symbol=symbol,
                signal_type=signal_type,
                price=latest_price,
                timestamp=datetime.now(),
                price_velocity=latest_velocity,
                price_curvature=latest_curvature,
                volume_sensitivity=latest_volume_sensitivity,
                atr_stop_loss=hard_stop_loss,
                trailing_stop=trailing_stop,
                confidence_score=confidence_score,
                institutional_volume_factor=latest_institutional_factor,
            )

        except Exception as e:
            logger.error(f"Error generating PDM signal for {symbol}: {e}")
            return None

    def _compute_confidence_score(
        self,
        sma_20: float,
        sma_200: float,
        price: float,
        velocity: float,
        curvature: float,
        institutional_factor: float,
    ) -> float:
        """
        Continuous confidence score in [0, 1]. Replaces the previous
        all-or-nothing scoring (each component contributed exactly 0.0 or
        1.0 regardless of magnitude) with a magnitude-aware score, so a
        stock barely above its SMA200 no longer scores identically to one
        far above it.
        """
        # Trend strength: how far price/SMA20 sit above SMA200, normalized
        # and clipped to [0, 1] (saturates at +10% above SMA200).
        trend_gap = (sma_20 - sma_200) / sma_200 if sma_200 else 0.0
        trend_component = float(np.clip(trend_gap / 0.10, 0.0, 1.0))

        # Velocity strength relative to price scale (saturates at +2%/day).
        velocity_pct = (velocity / price) if price else 0.0
        velocity_component = float(np.clip(velocity_pct / 0.02, 0.0, 1.0)) if velocity > 0 else 0.0

        # Early impulse: reward negative curvature (deceleration of an
        # already-positive move = momentum peak capture), saturating at a
        # curvature of -1% of price per day^2.
        curvature_pct = (curvature / price) if price else 0.0
        curvature_component = float(np.clip(-curvature_pct / 0.01, 0.0, 1.0)) if curvature < 0 else 0.0

        institutional_component = float(np.clip(institutional_factor / 2.0, 0.0, 1.0))

        components = [trend_component, velocity_component, curvature_component, institutional_component]
        return float(sum(components) / len(components))

    def scan_universe_for_opportunities(self) -> List[PDMSignal]:
        """
        Scan the stock universe for PDM opportunities.

        Fetches each symbol's OHLCV data exactly once (covering both the
        liquidity-filter window and the full signal-generation lookback),
        concurrently across `max_workers` threads, then evaluates every
        liquidity-qualified symbol - no arbitrary demo cap on how many
        candidates get scanned (see `max_scan_candidates` if you need to
        bound latency deliberately).

        Returns:
            List of PDM signals for stocks meeting entry criteria
        """
        fetch_days = self.lookback_period + 50
        universe_data = self.fetch_universe_data(self.indian_market_symbols, fetch_days)

        liquid_stocks = self.filter_stocks_by_liquidity(
            self.indian_market_symbols, universe_data=universe_data
        )

        candidates = liquid_stocks[: self.max_scan_candidates]
        if len(liquid_stocks) > self.max_scan_candidates:
            logger.info(
                f"Scanning {self.max_scan_candidates}/{len(liquid_stocks)} liquidity-qualified "
                f"candidates (max_scan_candidates cap)"
            )

        signals = []
        for symbol in candidates:
            signal = self.generate_pdm_signals(symbol, stock_data=universe_data.get(symbol))
            if signal and signal.signal_type == "LONG":
                signals.append(signal)
                logger.info(
                    f"PDM LONG signal generated for {symbol} at {signal.price:.2f}"
                )

        signals.sort(key=lambda x: x.confidence_score, reverse=True)
        return signals[: self.maximum_positions]

    def backtest_pdm_strategy(
        self,
        start_date: str,
        end_date: str,
        symbols: Optional[List[str]] = None,
        holding_period_days: int = 20,
        initial_capital: float = 1_000_000.0,
    ) -> Dict:
        """
        Backtest the PDM strategy over a specified period using real
        historical signal generation - replacing the previous implementation,
        which returned a hardcoded `strategy_return = 42.8` regardless of the
        requested period.

        Methodology: walk each symbol's price history day-by-day, computing
        the same indicators used live (SMA20/200, velocity, curvature,
        institutional factor) with an expanding window; whenever a LONG
        signal fires, open a position sized by `calculate_position_size` and
        exit after `holding_period_days` trading days (or at the period end,
        whichever comes first). This is intentionally simple - no slippage,
        no partial fills, one open position per symbol at a time - but every
        number in the result is actually computed from price data rather
        than fabricated.

        Args:
            start_date: Start date for backtesting (YYYY-MM-DD)
            end_date: End date for backtesting (YYYY-MM-DD)
            symbols: Universe to backtest (defaults to the configured NIFTY sample)
            holding_period_days: Trading days to hold each LONG signal
            initial_capital: Starting capital for the simulation

        Returns:
            Dictionary containing backtest results
        """
        try:
            nifty_data = yf.download(
                "^NSEI", start=start_date, end=end_date, progress=False, threads=False
            )
            if nifty_data.empty:
                return {"error": "No benchmark data available for the requested period"}

            benchmark_return = (
                (nifty_data["Close"].iloc[-1] / nifty_data["Close"].iloc[0]) - 1
            ) * 100

            universe = symbols or self.indian_market_symbols
            # Extra lookback buffer so indicators (SMA200 etc.) are valid from day one.
            buffer_start = (
                pd.Timestamp(start_date) - pd.Timedelta(days=self.lookback_period + 60)
            ).strftime("%Y-%m-%d")

            trades: List[Dict] = []
            per_symbol_allocation = initial_capital / max(len(universe), 1)

            for symbol in universe:
                history = self._fetch_history_range(symbol, buffer_start, end_date)
                if history is None or len(history) < 210:
                    continue

                trades.extend(
                    self._simulate_symbol_trades(
                        symbol, history, start_date, end_date, holding_period_days, per_symbol_allocation
                    )
                )

            if not trades:
                return {
                    "strategy_return": "0.0%",
                    "benchmark_return": f"{benchmark_return:.1f}%",
                    "outperformance": f"{-benchmark_return:.1f}%",
                    "period": f"{start_date} to {end_date}",
                    "total_trades": 0,
                    "max_positions": self.maximum_positions,
                    "methodology": "Calculus-based PDM with institutional volume analysis",
                    "note": "No qualifying LONG signals were generated in this period.",
                }

            total_pnl = sum(t["pnl"] for t in trades)
            strategy_return = (total_pnl / initial_capital) * 100
            winning_trades = sum(1 for t in trades if t["pnl"] > 0)

            returns = np.array([t["return_pct"] for t in trades])
            sharpe_like = (
                float(returns.mean() / returns.std() * np.sqrt(len(returns)))
                if len(returns) > 1 and returns.std() > 0
                else 0.0
            )

            return {
                "strategy_return": f"{strategy_return:.1f}%",
                "benchmark_return": f"{benchmark_return:.1f}%",
                "outperformance": f"{strategy_return - benchmark_return:.1f}%",
                "period": f"{start_date} to {end_date}",
                "total_trades": len(trades),
                "winning_trades": winning_trades,
                "win_rate": round(winning_trades / len(trades), 3),
                "sharpe_like_ratio": round(sharpe_like, 2),
                "max_positions": self.maximum_positions,
                "methodology": "Calculus-based PDM with institutional volume analysis",
            }

        except Exception as e:
            logger.error(f"Backtest error: {e}")
            return {"error": "Backtest failed"}

    def _fetch_history_range(self, symbol: str, start: str, end: str) -> Optional[pd.DataFrame]:
        try:
            data = yf.download(symbol, start=start, end=end, progress=False, threads=False)
            if data.empty:
                return None
            required_columns = ["Open", "High", "Low", "Close", "Volume"]
            return data.dropna(subset=required_columns)
        except Exception as e:
            logger.warning(f"Could not fetch backtest data for {symbol}: {e}")
            return None

    def _simulate_symbol_trades(
        self,
        symbol: str,
        history: pd.DataFrame,
        start_date: str,
        end_date: str,
        holding_period_days: int,
        allocation: float,
    ) -> List[Dict]:
        """Walk one symbol's history and simulate non-overlapping LONG trades."""
        close = history["Close"]
        velocity = self.calculate_price_velocity(close)
        curvature = self.calculate_price_curvature(close)
        sma_20 = close.rolling(window=20).mean()
        sma_200 = close.rolling(window=200).mean()
        atr = self.calculate_average_true_range(history["High"], history["Low"], close)
        institutional_factor = self.detect_institutional_volume_participation(
            history["Volume"], close
        )

        eval_start_idx = history.index.searchsorted(pd.Timestamp(start_date))
        eval_end_idx = history.index.searchsorted(pd.Timestamp(end_date))

        trades: List[Dict] = []
        i = max(eval_start_idx, 200)

        while i < min(eval_end_idx, len(history) - 1):
            trend_confirmation = sma_20.iloc[i] > sma_200.iloc[i] and close.iloc[i] > sma_20.iloc[i]
            positive_velocity = velocity.iloc[i] > 0
            early_impulse = curvature.iloc[i] < 0
            volume_validation = institutional_factor.iloc[i] > 1.2

            if trend_confirmation and positive_velocity and early_impulse and volume_validation:
                entry_price = float(close.iloc[i])
                exit_idx = min(i + holding_period_days, len(history) - 1)
                exit_price = float(close.iloc[exit_idx])

                current_atr = float(atr.iloc[i]) if not np.isnan(atr.iloc[i]) else 0.0
                shares = self.calculate_position_size(allocation, entry_price, current_atr)

                if shares > 0:
                    pnl = (exit_price - entry_price) * shares
                    trades.append(
                        {
                            "symbol": symbol,
                            "entry_date": str(history.index[i].date()),
                            "exit_date": str(history.index[exit_idx].date()),
                            "entry_price": entry_price,
                            "exit_price": exit_price,
                            "shares": shares,
                            "pnl": pnl,
                            "return_pct": (exit_price / entry_price - 1) * 100,
                        }
                    )

                i = exit_idx + 1  # non-overlapping trades
            else:
                i += 1

        return trades


# Example usage and testing
if __name__ == "__main__":
    # Initialize PDM engine
    pdm_engine = PriceVolumeDerivativesEngine()

    # Test signal generation for a single stock
    test_signal = pdm_engine.generate_pdm_signals("RELIANCE.NS")
    if test_signal:
        logger.info(
            f"Test signal: {test_signal.symbol} - {test_signal.signal_type} at {test_signal.price:.2f}"
        )

    # Scan for opportunities
    logger.info("Scanning universe for PDM opportunities...")
    opportunities = pdm_engine.scan_universe_for_opportunities()
    logger.info(f"Found {len(opportunities)} PDM opportunities")
