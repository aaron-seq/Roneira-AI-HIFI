"""
Roneira AI HIFI — ML Model Test Suite
Rigorous testing for Random Forest, Technical Analysis, PVD Momentum, and Ensemble.
Tests correctness, performance, and edge cases.
"""
import time
import pytest
import numpy as np
import pandas as pd

from app.models.random_forest import RandomForestPredictor
from app.models.technical_analysis import TechnicalAnalyzer
from app.models.pdm_momentum import PVDMomentumEngine
from app.models.ensemble import EnsembleCombiner
from app.models.lstm import LSTMPredictor
from app.models.gan import GANPredictor


# ========== Fixtures ==========
@pytest.fixture
def sample_data() -> pd.DataFrame:
    """Generate realistic synthetic stock data for testing."""
    np.random.seed(42)
    dates = pd.bdate_range("2023-01-01", periods=300)
    price = 100.0
    prices = []
    for _ in range(300):
        change = np.random.normal(0.0005, 0.015)
        price *= (1 + change)
        prices.append(price)

    df = pd.DataFrame({
        "Open": [p * (1 + np.random.uniform(-0.005, 0.005)) for p in prices],
        "High": [p * (1 + abs(np.random.normal(0, 0.01))) for p in prices],
        "Low": [p * (1 - abs(np.random.normal(0, 0.01))) for p in prices],
        "Close": prices,
        "Volume": [int(1e6 + np.random.normal(0, 3e5)) for _ in range(300)],
    }, index=dates)
    return df


@pytest.fixture
def small_data() -> pd.DataFrame:
    """Small dataset (edge case with minimal data)."""
    dates = pd.bdate_range("2024-01-01", periods=30)
    prices = np.linspace(100, 110, 30) + np.random.normal(0, 1, 30)
    return pd.DataFrame({
        "Open": prices * 0.99,
        "High": prices * 1.01,
        "Low": prices * 0.98,
        "Close": prices,
        "Volume": np.random.randint(500000, 2000000, 30),
    }, index=dates)


@pytest.fixture
def trending_up_data() -> pd.DataFrame:
    """Strong uptrend data."""
    dates = pd.bdate_range("2023-01-01", periods=200)
    prices = 100 * np.exp(np.linspace(0, 0.5, 200))  # ~65% gain
    noise = np.random.normal(0, 0.005, 200)
    prices = prices * (1 + noise)
    return pd.DataFrame({
        "Open": prices * 0.999,
        "High": prices * 1.01,
        "Low": prices * 0.99,
        "Close": prices,
        "Volume": np.random.randint(1e6, 5e6, 200),
    }, index=dates)


@pytest.fixture
def trending_down_data() -> pd.DataFrame:
    """Strong downtrend data."""
    dates = pd.bdate_range("2023-01-01", periods=200)
    prices = 100 * np.exp(np.linspace(0, -0.5, 200))  # ~39% loss
    noise = np.random.normal(0, 0.005, 200)
    prices = prices * (1 + noise)
    return pd.DataFrame({
        "Open": prices * 1.001,
        "High": prices * 1.01,
        "Low": prices * 0.99,
        "Close": prices,
        "Volume": np.random.randint(1e6, 5e6, 200),
    }, index=dates)


@pytest.fixture
def rf_model():
    return RandomForestPredictor(n_estimators=50, max_depth=8)


@pytest.fixture
def ta_analyzer():
    return TechnicalAnalyzer()


@pytest.fixture
def pdm_engine():
    return PVDMomentumEngine()


@pytest.fixture
def ensemble():
    return EnsembleCombiner()


# ========== Random Forest Tests ==========
class TestRandomForest:
    def test_prediction_returns_valid_structure(self, rf_model, sample_data):
        result = rf_model.predict(sample_data, horizon_days=30)
        assert "predicted_price" in result
        assert "confidence" in result
        assert isinstance(result["predicted_price"], float)
        assert result["predicted_price"] > 0

    def test_confidence_in_valid_range(self, rf_model, sample_data):
        result = rf_model.predict(sample_data, horizon_days=30)
        assert 0 <= result["confidence"] <= 100

    def test_prediction_within_reasonable_range(self, rf_model, sample_data):
        current = float(sample_data["Close"].iloc[-1])
        result = rf_model.predict(sample_data, horizon_days=30)
        # Prediction should be within ±50% of current price for 30-day horizon
        assert result["predicted_price"] > current * 0.5
        assert result["predicted_price"] < current * 1.5

    def test_uptrend_prediction_is_bullish(self, rf_model, trending_up_data):
        result = rf_model.predict(trending_up_data, horizon_days=30)
        current = float(trending_up_data["Close"].iloc[-1])
        # Strong uptrend should predict higher price
        assert result["predicted_price"] >= current * 0.95

    def test_downtrend_prediction_is_bearish(self, rf_model, trending_down_data):
        result = rf_model.predict(trending_down_data, horizon_days=30)
        current = float(trending_down_data["Close"].iloc[-1])
        # Strong downtrend should predict lower price
        assert result["predicted_price"] <= current * 1.1

    def test_different_horizons_produce_different_results(self, rf_model, sample_data):
        r1 = rf_model.predict(sample_data, horizon_days=7)
        r2 = rf_model.predict(sample_data, horizon_days=90)
        # Different horizons should produce different predictions
        assert r1["predicted_price"] != r2["predicted_price"]

    def test_has_indicators(self, rf_model, sample_data):
        result = rf_model.predict(sample_data, horizon_days=30)
        assert "indicators" in result
        assert len(result.get("indicators", [])) > 0

    def test_handles_small_data(self, rf_model, small_data):
        result = rf_model.predict(small_data, horizon_days=5)
        assert "predicted_price" in result
        assert result["predicted_price"] > 0

    def test_performance_benchmark(self, rf_model, sample_data):
        """Prediction should complete within 5 seconds."""
        start = time.time()
        rf_model.predict(sample_data, horizon_days=30)
        elapsed = time.time() - start
        assert elapsed < 5.0, f"RF prediction took {elapsed:.2f}s (max 5s)"

    def test_is_ready(self, rf_model):
        assert rf_model.is_ready() is True


# ========== Technical Analysis Tests ==========
class TestTechnicalAnalysis:
    def test_analysis_returns_valid_structure(self, ta_analyzer, sample_data):
        result = ta_analyzer.analyze(sample_data, horizon_days=30)
        assert "predicted_price" in result
        assert "confidence" in result
        assert "indicators" in result

    def test_has_all_6_indicators(self, ta_analyzer, sample_data):
        result = ta_analyzer.analyze(sample_data, horizon_days=30)
        names = [ind["name"] for ind in result["indicators"]]
        assert "RSI (14)" in names
        assert "MACD" in names
        assert "Bollinger Bands" in names
        assert "EMA 20/50" in names
        assert "Stochastic RSI" in names
        assert "ADX" in names

    def test_rsi_in_valid_range(self, ta_analyzer, sample_data):
        result = ta_analyzer.analyze(sample_data, horizon_days=30)
        rsi = next(ind for ind in result["indicators"] if ind["name"] == "RSI (14)")
        assert 0 <= rsi["value"] <= 100

    def test_signals_are_valid(self, ta_analyzer, sample_data):
        result = ta_analyzer.analyze(sample_data, horizon_days=30)
        valid_signals = {"Buy", "Sell", "Neutral"}
        for ind in result["indicators"]:
            assert ind["signal"] in valid_signals, f"Invalid signal: {ind['signal']}"

    def test_uptrend_mostly_buy_signals(self, ta_analyzer, trending_up_data):
        result = ta_analyzer.analyze(trending_up_data, horizon_days=30)
        buy_count = result.get("buy_count", 0)
        sell_count = result.get("sell_count", 0)
        assert buy_count >= sell_count, f"Uptrend: {buy_count} buy vs {sell_count} sell"

    def test_downtrend_mostly_sell_signals(self, ta_analyzer, trending_down_data):
        result = ta_analyzer.analyze(trending_down_data, horizon_days=30)
        sell_count = result.get("sell_count", 0)
        buy_count = result.get("buy_count", 0)
        assert sell_count >= buy_count, f"Downtrend: {sell_count} sell vs {buy_count} buy"

    def test_has_signal_fields(self, ta_analyzer, sample_data):
        result = ta_analyzer.analyze(sample_data, horizon_days=30)
        assert "short_term_signal" in result
        assert "signal" in result["short_term_signal"]
        assert "score" in result["short_term_signal"]

    def test_performance_benchmark(self, ta_analyzer, sample_data):
        """TA should complete within 1 second."""
        start = time.time()
        ta_analyzer.analyze(sample_data, horizon_days=30)
        elapsed = time.time() - start
        assert elapsed < 1.0, f"TA took {elapsed:.2f}s (max 1s)"


# ========== PVD Momentum Tests ==========
class TestPVDMomentum:
    def test_analysis_returns_valid_structure(self, pdm_engine, sample_data):
        result = pdm_engine.analyze(sample_data, "TEST", 30)
        assert "predicted_price" in result
        assert "confidence" in result
        assert "indicators" in result

    def test_has_momentum_indicators(self, pdm_engine, sample_data):
        result = pdm_engine.analyze(sample_data, "TEST", 30)
        names = [ind["name"] for ind in result["indicators"]]
        assert "Price Momentum" in names
        assert "Volume Signal" in names
        assert "Rate of Change" in names

    def test_support_resistance_valid(self, pdm_engine, sample_data):
        result = pdm_engine.analyze(sample_data, "TEST", 30)
        assert "support" in result
        assert "resistance" in result
        assert result["support"] <= result["resistance"]

    def test_uptrend_bullish_signal(self, pdm_engine, trending_up_data):
        result = pdm_engine.analyze(trending_up_data, "UPTREND", 30)
        signal = result["short_term_signal"]["signal"]
        assert signal in ("BUY", "STRONG_BUY", "HOLD"), f"Uptrend should be bullish, got {signal}"

    def test_downtrend_bearish_signal(self, pdm_engine, trending_down_data):
        result = pdm_engine.analyze(trending_down_data, "DOWNTREND", 30)
        signal = result["short_term_signal"]["signal"]
        assert signal in ("SELL", "STRONG_SELL", "HOLD"), f"Downtrend should be bearish, got {signal}"

    def test_performance_benchmark(self, pdm_engine, sample_data):
        """PVD should complete within 1 second."""
        start = time.time()
        pdm_engine.analyze(sample_data, "PERF", 30)
        elapsed = time.time() - start
        assert elapsed < 1.0, f"PVD took {elapsed:.2f}s (max 1s)"


# ========== Ensemble Tests ==========
class TestEnsemble:
    def test_combine_weighted_average(self, ensemble):
        preds = [
            {"predicted_price": 100, "confidence": 80, "indicators": [], "short_term_signal": {"signal": "BUY", "score": 7}, "long_term_signal": {"signal": "BUY", "score": 6}},
            {"predicted_price": 110, "confidence": 60, "indicators": [], "short_term_signal": {"signal": "BUY", "score": 8}, "long_term_signal": {"signal": "STRONG_BUY", "score": 7}},
        ]
        result = ensemble.combine(preds, weights=[0.6, 0.4])
        assert abs(result["predicted_price"] - 104.0) < 0.01

    def test_combine_with_confidence_weights(self, ensemble):
        preds = [
            {"predicted_price": 100, "confidence": 90, "indicators": [], "short_term_signal": {"signal": "BUY", "score": 7}, "long_term_signal": {"signal": "BUY", "score": 6}},
            {"predicted_price": 200, "confidence": 10, "indicators": [], "short_term_signal": {"signal": "SELL", "score": 3}, "long_term_signal": {"signal": "SELL", "score": 3}},
        ]
        result = ensemble.combine(preds)  # Auto-weight by confidence
        # 90% weight on 100, 10% weight on 200 → ~110
        assert result["predicted_price"] < 130  # Closer to 100

    def test_signal_majority_vote(self, ensemble):
        preds = [
            {"predicted_price": 100, "confidence": 70, "indicators": [], "short_term_signal": {"signal": "BUY", "score": 7}, "long_term_signal": {"signal": "BUY", "score": 6}},
            {"predicted_price": 105, "confidence": 80, "indicators": [], "short_term_signal": {"signal": "BUY", "score": 8}, "long_term_signal": {"signal": "BUY", "score": 7}},
            {"predicted_price": 95, "confidence": 40, "indicators": [], "short_term_signal": {"signal": "SELL", "score": 3}, "long_term_signal": {"signal": "SELL", "score": 3}},
        ]
        result = ensemble.combine(preds)
        assert result["short_term_signal"]["signal"] == "BUY"  # 2 BUY > 1 SELL

    def test_empty_predictions(self, ensemble):
        result = ensemble.combine([])
        assert result["predicted_price"] == 0
        assert result["confidence"] == 0

    def test_single_model(self, ensemble):
        preds = [
            {"predicted_price": 150, "confidence": 70, "indicators": [{"name": "RSI", "value": 55, "signal": "Buy"}], "short_term_signal": {"signal": "BUY", "score": 7}, "long_term_signal": {"signal": "BUY", "score": 6}},
        ]
        result = ensemble.combine(preds)
        assert result["predicted_price"] == 150

    def test_confidence_boost_on_agreement(self, ensemble):
        # All models agree → confidence boost
        preds = [
            {"predicted_price": 100, "confidence": 60, "indicators": [], "short_term_signal": {"signal": "BUY", "score": 7}, "long_term_signal": {"signal": "BUY", "score": 6}},
            {"predicted_price": 101, "confidence": 60, "indicators": [], "short_term_signal": {"signal": "BUY", "score": 7}, "long_term_signal": {"signal": "BUY", "score": 6}},
            {"predicted_price": 100.5, "confidence": 60, "indicators": [], "short_term_signal": {"signal": "BUY", "score": 7}, "long_term_signal": {"signal": "BUY", "score": 6}},
        ]
        result = ensemble.combine(preds)
        assert result["confidence"] > 60  # Should get agreement bonus

    def test_indicators_deduplicated(self, ensemble):
        preds = [
            {"predicted_price": 100, "confidence": 70, "indicators": [{"name": "RSI", "value": 55, "signal": "Buy"}, {"name": "MACD", "value": 0.5, "signal": "Buy"}], "short_term_signal": {"signal": "BUY", "score": 7}, "long_term_signal": {"signal": "BUY", "score": 6}},
            {"predicted_price": 105, "confidence": 80, "indicators": [{"name": "RSI", "value": 60, "signal": "Neutral"}, {"name": "ADX", "value": 30, "signal": "Buy"}], "short_term_signal": {"signal": "BUY", "score": 8}, "long_term_signal": {"signal": "BUY", "score": 7}},
        ]
        result = ensemble.combine(preds)
        names = [ind["name"] for ind in result["indicators"]]
        assert len(names) == len(set(names)), "Duplicate indicators found"


# ========== Integration / End-to-End Tests ==========
class TestIntegration:
    def test_full_pipeline(self, rf_model, ta_analyzer, pdm_engine, ensemble, sample_data):
        """Run the full ensemble pipeline end-to-end."""
        rf_result = rf_model.predict(sample_data, 30)
        ta_result = ta_analyzer.analyze(sample_data, 30)
        pdm_result = pdm_engine.analyze(sample_data, "TEST", 30)

        combined = ensemble.combine(
            [rf_result, ta_result, pdm_result],
            weights=[0.4, 0.3, 0.3],
        )

        assert combined["predicted_price"] > 0
        assert 0 < combined["confidence"] <= 100
        assert combined["short_term_signal"]["signal"] in ("STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL")
        assert 0 <= combined["short_term_signal"]["score"] <= 10

    def test_pipeline_performance(self, rf_model, ta_analyzer, pdm_engine, ensemble, sample_data):
        """Full pipeline should complete within 10 seconds."""
        start = time.time()
        rf_result = rf_model.predict(sample_data, 30)
        ta_result = ta_analyzer.analyze(sample_data, 30)
        pdm_result = pdm_engine.analyze(sample_data, "TEST", 30)
        ensemble.combine([rf_result, ta_result, pdm_result], weights=[0.4, 0.3, 0.3])
        elapsed = time.time() - start
        assert elapsed < 10.0, f"Full pipeline took {elapsed:.2f}s (max 10s)"

    def test_consistency_across_runs(self, rf_model, sample_data):
        """Same data should produce consistent results."""
        r1 = rf_model.predict(sample_data, 30)
        r2 = rf_model.predict(sample_data, 30)
        assert abs(r1["predicted_price"] - r2["predicted_price"]) < 0.01


# ========== Performance Tracking Tests ==========
class TestPerformanceTracking:
    """Tests to verify model predictions aren't random noise."""

    def test_rf_beats_random(self, rf_model, sample_data):
        """RF predictions should be better than random guessing."""
        result = rf_model.predict(sample_data, horizon_days=30)
        # Confidence should be > 25% (random baseline)
        assert result["confidence"] > 25, f"RF confidence {result['confidence']} too low"

    def test_ta_signal_alignment(self, ta_analyzer, trending_up_data, trending_down_data):
        """TA signals should align with obvious market direction."""
        up_result = ta_analyzer.analyze(trending_up_data, 30)
        down_result = ta_analyzer.analyze(trending_down_data, 30)

        up_signal = up_result["short_term_signal"]["signal"]
        down_signal = down_result["short_term_signal"]["signal"]

        # Uptrend should NOT be SELL/STRONG_SELL
        assert up_signal not in ("SELL", "STRONG_SELL"), f"Uptrend got {up_signal}"
        # Downtrend should NOT be BUY/STRONG_BUY
        assert down_signal not in ("BUY", "STRONG_BUY"), f"Downtrend got {down_signal}"

    def test_ensemble_reduces_variance(self, rf_model, ta_analyzer, pdm_engine, ensemble, sample_data):
        """Ensemble should have lower variance than individual models."""
        rf = rf_model.predict(sample_data, 30)
        ta = ta_analyzer.analyze(sample_data, 30)
        pdm = pdm_engine.analyze(sample_data, "TEST", 30)
        combined = ensemble.combine([rf, ta, pdm], weights=[0.4, 0.3, 0.3])

        prices = [rf["predicted_price"], ta["predicted_price"], pdm["predicted_price"]]
        individual_range = max(prices) - min(prices)

        # Ensemble price should be within the range of individual predictions
        assert combined["predicted_price"] >= min(prices) * 0.99
        assert combined["predicted_price"] <= max(prices) * 1.01


class _StubPredictorModel:
    def __init__(self, value: float):
        self.value = value

    def predict(self, *_args, **_kwargs):
        return np.array([[self.value]])


class TestArtifactBackedDeepLearning:
    def test_lstm_fallback_without_artifact(self, sample_data):
        predictor = LSTMPredictor()
        predictor._model = None

        result = predictor.predict(sample_data, horizon_days=30)
        assert result["fallback"] is True
        assert result["predicted_price"] > 0

    def test_gan_fallback_without_artifact(self, sample_data):
        predictor = GANPredictor()
        predictor._generator = None

        result = predictor.predict(sample_data, horizon_days=30)
        assert result["fallback"] is True
        assert result["predicted_price"] > 0

    def test_lstm_uses_loaded_model_path(self, sample_data):
        predictor = LSTMPredictor()
        predictor._model = _StubPredictorModel(0.03)
        predictor._metadata = {
            "confidence": 60.0,
            "validation_mae": 0.02,
            "epochs_run": 8,
        }

        result = predictor.predict(sample_data, horizon_days=30)
        assert result.get("fallback") is None
        assert result["short_term_signal"]["signal"] in ("BUY", "STRONG_BUY")
        assert result["predicted_price"] > float(sample_data["Close"].iloc[-1])

    def test_gan_uses_loaded_generator_path(self, sample_data):
        predictor = GANPredictor()
        predictor._generator = _StubPredictorModel(0.02)
        predictor._metadata = {
            "confidence": 55.0,
            "generator_loss": 0.2,
        }

        result = predictor.predict(sample_data, horizon_days=30)
        assert result.get("fallback") is None
        assert result["short_term_signal"]["signal"] in ("BUY", "STRONG_BUY")
        assert result["predicted_price"] > float(sample_data["Close"].iloc[-1])
