"""Walk-forward harness (ml/backtest.py): the properties its numbers depend on."""
import numpy as np
import pandas as pd
import pytest

from backtest import Backtester, ensemble_variants, make_folds, score


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


def test_signal_precision_is_measured_against_the_base_rate():
    from backtest import signal_precision

    # Price rises 3 of 4 times; the model says BUY twice and is right once.
    result = signal_precision(np.array([1, 1, 0, -1]), np.array([0.02, -0.01, 0.03, 0.01]))
    assert result["base_up"] == pytest.approx(0.75)
    assert result["n_buy"] == 2 and result["p_up_given_buy"] == pytest.approx(0.5)
    assert result["n_sell"] == 1 and result["p_down_given_sell"] == pytest.approx(0.0)
