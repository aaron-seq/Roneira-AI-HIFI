"""Walk-forward harness (ml/backtest.py): the properties its numbers depend on."""
import numpy as np
import pandas as pd
import pytest

from backtest import Backtester, ensemble_variants, json_ready, make_folds, score, summarise
from app.horizons import serving_lookback


def _frame(n=900, seed=0, start="2015-01-01"):
    rng = np.random.default_rng(seed)
    close = 100 * np.exp(np.cumsum(rng.normal(0, 0.01, n)))
    index = pd.date_range(start, periods=n, freq="B", tz="UTC")
    return pd.DataFrame(
        {
            "Open": close,
            "High": close * 1.01,
            "Low": close * 0.99,
            "Close": close,
            "Volume": rng.integers(1_000, 10_000, n).astype(float),
        },
        index=index,
    )


def test_score_arithmetic():
    result = score(np.array([0.02, -0.01, 0.0]), np.array([0.04, 0.02, -0.03]))
    assert result["mae"] == pytest.approx((0.02 + 0.03 + 0.03) / 3)
    assert result["baseline_mae"] == pytest.approx((0.04 + 0.02 + 0.03) / 3)
    assert result["skill"] == pytest.approx(1 - 0.08 / 0.09)
    # The 0.0 call took no side, so hit rate is over the other two: 1 of 2.
    assert result["hit_rate"] == pytest.approx(0.5)


def test_skill_is_not_clipped():
    """A model worse than 'no change' must show it, not report 0."""
    assert score(np.array([0.1, -0.1]), np.array([-0.01, 0.01]))["skill"] < 0


def test_folds_are_contiguous_periods_with_non_overlapping_labels():
    frames = {"A": _frame(seed=1), "B": _frame(seed=2)}
    folds = make_folds(frames, n_folds=4, horizon=20, stride=20, min_history=252)

    assert len(folds) == 4
    for earlier, later in zip(folds, folds[1:]):
        last_earlier = max(frames[t].index[p] for t, p in earlier.origins)
        first_later = min(frames[t].index[p] for t, p in later.origins)
        assert last_earlier < first_later
    for fold in folds:
        for ticker, pos in fold.origins:
            assert pos >= 252 and pos + 20 < len(frames[ticker])
    positions = sorted(p for f in folds for t, p in f.origins if t == "A")
    assert all(b - a == 20 for a, b in zip(positions, positions[1:]))


def test_models_never_see_past_the_origin():
    frames = {"A": _frame()}
    tester = Backtester(frames, horizon=20)
    folds = make_folds(frames, n_folds=3, horizon=20, stride=40, min_history=252)
    seen = []

    def spy(window, horizon):
        seen.append(window.index[-1])
        assert len(window) <= tester.lookback
        return {"predicted_price": float(window["Close"].iloc[-1]) * 1.01}

    tester.ta.analyze = spy
    records = tester.run(folds, ["TECHNICAL"])

    expected = [frames["A"].index[p] for f in folds for _, p in f.origins]
    assert seen == expected
    assert all(r["TECHNICAL"] == pytest.approx(0.01) for r in records)


def test_inverse_mae_weights_only_learn_from_earlier_folds():
    rows = []
    for fold in range(3):
        for i in range(10):
            realised = 0.01 * (i - 5)
            rows.append({
                "fold": fold, "date": f"2020-0{fold + 1}-1{i}", "realised": realised,
                "origin_timestamp": f"2020-0{fold + 1}-1{i}T00:00:00Z",
                "label_timestamp": (pd.Timestamp(f"2020-0{fold + 1}-1{i}", tz="UTC") + pd.Timedelta(days=5)).isoformat(),
                "RANDOM_FOREST": realised,           # perfect
                "TECHNICAL": -realised,              # always wrong
                "PVD_MOMENTUM": 0.0,
                "LSTM": 0.0,
            })
    out = ensemble_variants(pd.DataFrame(rows))

    assert out.loc[out["fold"] == 0, "ENSEMBLE_INVERSE_MAE"].isna().all()
    later = out[out["fold"] > 0]
    # Learned from fold 0, the perfect member dominates, so the blend beats
    # equal weighting on the later folds.
    err_inverse = np.abs(later["ENSEMBLE_INVERSE_MAE"] - later["realised"]).mean()
    err_equal = np.abs(later["ENSEMBLE_EQUAL"] - later["realised"]).mean()
    assert err_inverse < err_equal
    assert "ENSEMBLE_PRODUCTION" in out


def test_inverse_mae_does_not_learn_labels_resolving_in_the_scored_fold():
    records = pd.DataFrame([
        {"fold": 0, "origin_timestamp": "2020-01-01T00:00:00Z", "label_timestamp": "2020-01-15T00:00:00Z",
         "realised": 0.02, "RANDOM_FOREST": 0.02, "TECHNICAL": -0.02},
        {"fold": 0, "origin_timestamp": "2020-01-25T00:00:00Z", "label_timestamp": "2020-02-15T00:00:00Z",
         "realised": -0.5, "RANDOM_FOREST": 0.5, "TECHNICAL": -0.5},
        {"fold": 1, "origin_timestamp": "2020-02-01T00:00:00Z", "label_timestamp": "2020-02-20T00:00:00Z",
         "realised": 0.03, "RANDOM_FOREST": 0.03, "TECHNICAL": -0.03},
    ])
    before = ensemble_variants(records)
    changed = records.copy()
    changed.loc[1, "realised"] = 0.5
    after = ensemble_variants(changed)
    assert before.loc[2, "ENSEMBLE_INVERSE_MAE"] == pytest.approx(0.03)
    assert after.loc[2, "ENSEMBLE_INVERSE_MAE"] == pytest.approx(before.loc[2, "ENSEMBLE_INVERSE_MAE"])


@pytest.mark.parametrize("purge_days", [0, 47])
def test_slot_labels_resolve_before_fold_start_even_with_missing_sessions(monkeypatch, purge_days):
    import backtest

    frame = _frame(n=1000)
    # A long suspension makes 30 observed sessions span more than the estimated
    # 47-day purge, exposing future labels if the full frame is used to train.
    frame = frame.drop(frame.index[810:850])
    cutoff = frame.index[825]
    tester = Backtester({"A": frame}, horizon=30, purge_days=purge_days)
    seen = []

    def prepare(historical):
        assert historical.index.max() < cutoff
        seen.append(historical)
        return historical[["Close"]].to_numpy()

    class Estimator:
        def fit(self, X, y):
            assert len(X) >= 500
            # Since build_training_windows gets no prices at or after cutoff,
            # it cannot construct a label resolving at or after that boundary.
            assert np.isfinite(y).all()

    monkeypatch.setattr(backtest, "build_estimator", Estimator)
    tester._fit_slot(prepare, sequence_length=30, cutoff=cutoff)
    assert len(seen) == 1


def test_inverse_mae_requires_label_availability_metadata():
    with pytest.raises(ValueError, match="label_timestamp"):
        ensemble_variants(pd.DataFrame({
            "fold": [0, 1], "realised": [0.01, 0.02],
            "RANDOM_FOREST": [0.01, 0.02], "TECHNICAL": [-0.01, -0.02],
        }))


def test_signal_precision_is_measured_against_the_base_rate():
    from backtest import signal_precision

    # Price rises 3 of 4 times; the model says BUY twice and is right once.
    result = signal_precision(np.array([1, 1, 0, -1]), np.array([0.02, -0.01, 0.03, 0.01]))
    assert result["base_up"] == pytest.approx(0.75)
    assert result["n_buy"] == 2 and result["p_up_given_buy"] == pytest.approx(0.5)
    assert result["n_sell"] == 1 and result["p_down_given_sell"] == pytest.approx(0.0)


def test_backtest_uses_shared_serving_history_policy():
    frame = _frame(n=1800)
    tester = Backtester({"A": frame}, horizon=365)
    assert tester.lookback == serving_lookback(365) == 1660
    seen = []

    def spy(window, horizon):
        seen.append(window)
        return {"predicted_price": window["Close"].iloc[-1]}

    tester.ta.analyze = spy
    tester._predict_all(frame, "A", 1700, ["TECHNICAL"])
    assert len(seen[0]) == 1660
    assert seen[0].index[-1] == frame.index[1700]


def test_fallback_predictions_are_missing_and_reported_in_coverage():
    frames = {"A": _frame()}
    tester = Backtester(frames, horizon=7)
    tester.ta.analyze = lambda window, horizon: {
        "predicted_price": window["Close"].iloc[-1],
        "fallback": True, "fallback_reason": "insufficient_history",
    }
    folds = make_folds(frames, 2, 7, 100, 504)
    records = pd.DataFrame(tester.run(folds, ["TECHNICAL"]))
    assert records["TECHNICAL"].isna().all()
    assert records["TECHNICAL:fallback"].all()
    assert set(records["TECHNICAL:fallback_reason"]) == {"insufficient_history"}
    summary = summarise(records, ["TECHNICAL"])["TECHNICAL"]
    assert summary["pooled"]["n"] == 0
    assert summary["coverage"]["fraction"] == 0
    assert summary["coverage"]["unavailable"] == len(records)


def test_production_ensemble_renormalises_only_available_members():
    records = pd.DataFrame([
        {"fold": 0, "date": "2020-01-01", "origin_timestamp": "2020-01-01T00:00:00Z",
         "label_timestamp": "2020-01-08T00:00:00Z", "realised": 0.03,
         "RANDOM_FOREST": 0.03, "TECHNICAL": 0.06, "PVD_MOMENTUM": np.nan, "LSTM": 0.0},
        {"fold": 1, "date": "2020-02-01", "origin_timestamp": "2020-02-01T00:00:00Z",
         "label_timestamp": "2020-02-08T00:00:00Z", "realised": 0.02,
         "RANDOM_FOREST": 0.03, "TECHNICAL": 0.06, "PVD_MOMENTUM": 0.0, "LSTM": 0.0},
        {"fold": 2, "date": "2020-03-01", "origin_timestamp": "2020-03-01T00:00:00Z",
         "label_timestamp": "2020-03-08T00:00:00Z", "realised": 0.02,
         "RANDOM_FOREST": np.nan, "TECHNICAL": np.nan, "PVD_MOMENTUM": np.nan, "LSTM": np.nan},
    ])
    out = ensemble_variants(records)
    assert out.loc[0, "ENSEMBLE_PRODUCTION"] == pytest.approx(0.03)
    assert np.isnan(out.loc[0, "ENSEMBLE_RF_RULES"])
    assert out.loc[0, "ensemble_eligible_members"] == 3
    assert bool(out.loc[0, "ensemble_degraded"])
    assert np.isnan(out.loc[0, "ENSEMBLE_EQUAL"])
    # An incomplete earlier row cannot teach inverse-MAE weights.
    assert np.isnan(out.loc[1, "ENSEMBLE_INVERSE_MAE"])
    assert out.loc[1, "ENSEMBLE_RF_RULES"] == pytest.approx(0.03)
    assert np.isnan(out.loc[2, "ENSEMBLE_PRODUCTION"])
    summary = summarise(out, ["ENSEMBLE_PRODUCTION"])["ENSEMBLE_PRODUCTION"]
    assert summary["coverage"] == {
        "origins": 3, "scored": 2, "unavailable": 1, "fraction": pytest.approx(2 / 3), "degraded": 1,
    }


def test_nonfinite_predictions_cannot_make_metrics_look_valid():
    with pytest.raises(ValueError, match="finite returns"):
        score([np.inf], [0.01])
    with pytest.raises(ValueError, match="aligned"):
        score([0.01], [0.01, 0.02])
    records = pd.DataFrame({
        "fold": [0, 0], "date": ["2020-01-01", "2020-01-08"],
        "realised": [0.02, 0.03], "TECHNICAL": [np.inf, 0.01],
    })
    summary = summarise(records, ["TECHNICAL"])["TECHNICAL"]
    assert summary["pooled"]["n"] == 1
    assert summary["coverage"]["unavailable"] == 1
    assert json_ready({"unavailable": np.nan, "infinite": np.inf, "count": np.int64(2)}) == {
        "unavailable": None, "infinite": None, "count": 2,
    }


def test_refitted_slots_are_horizon_and_contract_matched(monkeypatch):
    import backtest
    from sklearn.dummy import DummyRegressor

    frames = {"A": _frame(n=1400)}
    tester = Backtester(frames, horizon=7)
    estimators = []

    def estimator():
        model = DummyRegressor(strategy="constant", constant=0.0)
        estimators.append(model)
        return model

    # Exercise real window construction, artifact adapter, metadata checks
    # and both slot predictors; only the expensive estimator is substituted.
    monkeypatch.setattr(backtest, "build_estimator", estimator)
    folds = make_folds(frames, 1, 7, 100, 900)
    records = tester.run(folds, ["LSTM", "GAN"])
    assert len(estimators) == 2
    for model, artifact in [(tester.lstm, tester.lstm._model), (tester.gan, tester.gan._generator)]:
        assert model._metadata["horizon_days"] == 7
        assert model._metadata["window_contract"] == "origin-inclusive-v2"
        assert model._metadata["sequence_length"] == model.sequence_length
        assert model._metadata["n_features"] == artifact.n_features
        assert artifact.window_shape[0] == model.sequence_length
        assert artifact.trained_horizon_sessions == 7
    assert all(not record["LSTM:fallback"] and not record["GAN:fallback"] for record in records)
