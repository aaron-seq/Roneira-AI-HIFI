"""
Training pipeline tests.

`train_models.py` fetches real data from yfinance before calling into these
trainers, so it can't run anywhere without live internet access to Yahoo
Finance (blocked in some CI/sandboxed environments). The functions under test
here take already-fetched DataFrames, so they're exercised directly against
synthetic OHLCV data — this catches real bugs in the training math (window
construction, label alignment, artifact save/load) independent of network
availability, and runs in seconds.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.models.gan import GANPredictor
from app.models.gradient_boost import build_training_windows, fit_windows
from app.models.lstm import LSTMPredictor


def _synthetic_ohlcv(seed: int, periods: int = 500, start_price: float = 100.0) -> pd.DataFrame:
    """Deterministic geometric-random-walk OHLCV frame, shaped like a real
    yfinance download (same columns, business-day index, no gaps)."""
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range("2022-01-03", periods=periods)

    prices = [start_price]
    for _ in range(periods - 1):
        prices.append(prices[-1] * (1 + rng.normal(0.0004, 0.016)))
    close = np.array(prices)

    open_ = close * (1 + rng.uniform(-0.004, 0.004, periods))
    high = np.maximum(open_, close) * (1 + np.abs(rng.normal(0, 0.006, periods)))
    low = np.minimum(open_, close) * (1 - np.abs(rng.normal(0, 0.006, periods)))
    volume = (1_000_000 + rng.normal(0, 2e5, periods)).clip(min=1).astype(int)

    return pd.DataFrame(
        {"Open": open_, "High": high, "Low": low, "Close": close, "Volume": volume},
        index=dates,
    )


@pytest.fixture
def training_frames() -> list[pd.DataFrame]:
    # Multiple tickers, like the real DEFAULT_TICKERS batch in train_models.py,
    # so build_training_windows exercises its multi-frame concatenation path.
    return [_synthetic_ohlcv(seed) for seed in (1, 2, 3)]


@pytest.fixture(autouse=True)
def isolated_artifact_dir(tmp_path, monkeypatch):
    """Redirect ML_MODEL_DIR so training never touches the real, committed
    production artifacts under ml/artifacts/generated/."""
    monkeypatch.setenv("ML_MODEL_DIR", str(tmp_path))
    yield tmp_path


class TestGradientBoostCore:
    def test_build_training_windows_shapes(self, training_frames):
        predictor = LSTMPredictor(sequence_length=60)
        windows, targets = build_training_windows(
            training_frames,
            predictor._prepare_features,
            sequence_length=60,
            horizon_days=30,
        )
        assert windows.ndim == 3
        assert windows.shape[0] == targets.shape[0]
        assert windows.shape[1] == 60
        assert np.isfinite(windows).all()
        assert np.isfinite(targets).all()

    def test_build_training_windows_rejects_empty_input(self):
        with pytest.raises(ValueError):
            build_training_windows([], lambda df: df.values, 60, 30)

    def test_fit_windows_rejects_too_few_samples(self):
        tiny_windows = np.zeros((5, 3, 2))
        tiny_targets = np.zeros(5)
        with pytest.raises(ValueError):
            fit_windows(tiny_windows, tiny_targets)

    def test_fit_windows_produces_sane_metrics(self, training_frames):
        predictor = LSTMPredictor(sequence_length=60)
        windows, targets = build_training_windows(
            training_frames, predictor._prepare_features, 60, 30
        )
        artifact, metrics = fit_windows(windows, targets, purge=30)

        assert metrics["training_windows"] == len(windows)
        assert metrics["validation_mae"] >= 0
        assert metrics["validation_rmse"] >= 0
        # RMSE is always >= MAE for the same error distribution (power-mean inequality).
        assert metrics["validation_rmse"] >= metrics["validation_mae"]
        assert 35.0 <= metrics["confidence"] <= 85.0
        assert metrics["backend"] in ("xgboost", "sklearn")

        # The artifact must round-trip through the same Keras-shaped call the
        # inference code actually uses.
        sample_window = windows[0].reshape(1, *windows[0].shape)
        prediction = artifact.predict(sample_window, verbose=0)
        assert prediction.shape == (1, 1)
        assert np.isfinite(prediction).all()


class TestLSTMSlotTraining:
    def test_train_gradient_boost_end_to_end(self, training_frames):
        predictor = LSTMPredictor(sequence_length=60)
        assert not predictor.is_ready()  # isolated_artifact_dir has no prior artifact

        metrics = predictor.train_gradient_boost(training_frames, horizon_days=30)

        assert predictor.is_ready()
        assert metrics["backend_slot"] == "lstm"
        assert metrics["trained_on_frames"] == len(training_frames)
        assert metrics["sequence_length"] == 60

        # A fresh instance must load what was just saved, without retraining.
        reloaded = LSTMPredictor(sequence_length=60)
        assert reloaded.is_ready()

    def test_predict_after_training_is_not_fallback(self, training_frames):
        predictor = LSTMPredictor(sequence_length=60)
        predictor.train_gradient_boost(training_frames, horizon_days=30)

        result = predictor.predict(training_frames[0], horizon_days=30)

        assert result.get("fallback") is not True
        assert "predicted_price" in result
        assert result["predicted_price"] > 0
        assert result["short_term_signal"]["signal"] in {
            "STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL",
        }

    def test_predict_falls_back_gracefully_when_untrained(self, training_frames):
        # No training call in this test — isolated_artifact_dir guarantees a
        # clean directory, so this instance has nothing to load.
        predictor = LSTMPredictor(sequence_length=60)
        result = predictor.predict(training_frames[0], horizon_days=30)
        assert result.get("fallback") is True


class TestGANSlotTraining:
    def test_train_gradient_boost_end_to_end(self, training_frames):
        predictor = GANPredictor(sequence_length=30)
        assert not predictor.is_ready()

        metrics = predictor.train_gradient_boost(training_frames, horizon_days=30)

        assert predictor.is_ready()
        assert metrics["backend_slot"] == "gan"
        assert metrics["trained_on_frames"] == len(training_frames)

        reloaded = GANPredictor(sequence_length=30)
        assert reloaded.is_ready()

    def test_predict_after_training_is_not_fallback(self, training_frames):
        predictor = GANPredictor(sequence_length=30)
        predictor.train_gradient_boost(training_frames, horizon_days=30)

        result = predictor.predict(training_frames[0], horizon_days=30)

        assert result.get("fallback") is not True
        assert "predicted_price" in result
        assert result["predicted_price"] > 0


class TestFeatureDepthInvariance:
    """
    A window must score the same regardless of how much history preceded it.

    This is the regression guard for the bug that made both sequence slots
    worthless: `close_norm = Close / Close.iloc[0]` was the top-importance
    feature in each booster, and its value is a function of the caller's
    `period=` argument. Training fetched period="max" (~25y); main.py serves
    period="1y"/"2y". The same session scored ~8.8 during training and ~1.4 in
    production, so the fitted split points addressed a range production never
    reaches. The frame-wide min-max in `_normalize` had the same defect plus a
    look-ahead leak, which is why the tree path no longer applies it.

    Any new feature reaching further back than SERVING_ROWS - sequence_length
    sessions will fail here. That is the point: it would silently reintroduce
    the same class of bug.
    """

    SERVING_ROWS = 252  # period="1y", the shortest window main.py fetches

    @pytest.mark.parametrize(
        ("factory", "prepare_attr", "sequence_length"),
        [
            (LSTMPredictor, "_prepare_features", 60),
            (GANPredictor, "_prepare_data", 30),
        ],
    )
    def test_window_is_independent_of_preceding_history(
        self, factory, prepare_attr, sequence_length
    ):
        frame = _synthetic_ohlcv(seed=7, periods=1200)
        prepare = getattr(factory(sequence_length=sequence_length), prepare_attr)

        deep = prepare(frame)[-sequence_length:]
        shallow = prepare(frame.iloc[-self.SERVING_ROWS:])[-sequence_length:]

        assert deep.shape == shallow.shape
        # 1e-5, not exact: the EMA features are infinite-impulse, so ~190 rows of
        # extra warm-up leaves a residue around 1e-7. Anchored or frame-wide
        # normalised features miss by whole units, not by 1e-7.
        np.testing.assert_allclose(deep, shallow, atol=1e-5)

    def test_prediction_is_independent_of_preceding_history(self, training_frames):
        frame = _synthetic_ohlcv(seed=8, periods=1200)
        predictor = LSTMPredictor(sequence_length=60)
        predictor.train_gradient_boost(training_frames, horizon_days=30)

        deep = predictor.predict(frame, horizon_days=30)
        shallow = predictor.predict(frame.iloc[-self.SERVING_ROWS:], horizon_days=30)

        assert deep.get("fallback") is not True
        assert deep["predicted_return"] == pytest.approx(shallow["predicted_return"], abs=0.01)


class TestChronologicalPooling:
    """`fit_windows` splits on row order, so row order has to mean time."""

    def test_windows_are_sorted_by_date_across_frames(self):
        # Different seeds, so the two frames' prepared features differ. Using a
        # re-indexed copy of one frame would make this pass either way.
        early = _synthetic_ohlcv(seed=11, periods=400)
        late = _synthetic_ohlcv(seed=12, periods=400)
        late.index = pd.bdate_range("2030-01-01", periods=len(late))

        predictor = LSTMPredictor(sequence_length=60)
        # Deliberately out of order: appending frame-by-frame would put every
        # `late` window first, and the 80/20 split in fit_windows would then hold
        # out a different *ticker* while reporting a time split.
        windows, _ = build_training_windows(
            [late, early], predictor._prepare_features, 60, 30
        )
        np.testing.assert_allclose(
            windows[0], predictor._prepare_features(early)[0:60], atol=1e-9
        )
        # ...and the newest window is the last one `late` can supply: windows run
        # to index len - horizon - 1, beyond which the forward label is unknown.
        newest = len(late) - 30 - 1
        np.testing.assert_allclose(
            windows[-1],
            predictor._prepare_features(late)[newest - 60:newest],
            atol=1e-9,
        )

    def test_purge_drops_windows_whose_label_spans_the_split(self, training_frames):
        predictor = LSTMPredictor(sequence_length=60)
        windows, targets = build_training_windows(
            training_frames, predictor._prepare_features, 60, 30
        )
        _, unpurged = fit_windows(windows, targets, purge=0)
        _, purged = fit_windows(windows, targets, purge=30)

        # Same validation set; 30 fewer training rows, being exactly the ones
        # whose 30-day forward label resolves inside the validation period.
        assert purged["train_rows"] == unpurged["train_rows"] - 30
        assert purged["training_windows"] == unpurged["training_windows"]
