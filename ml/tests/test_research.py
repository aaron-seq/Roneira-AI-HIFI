"""Reproducible dataset boundaries, numerical invariants and worker bounds."""
from dataclasses import replace

import numpy as np
import pandas as pd
import pytest

from app.models.indicators import rolling_rsi
from app.models.gradient_boost import GradientBoostArtifact, artifact_contract_reason, WINDOW_CONTRACT
from app.models.random_forest import RandomForestPredictor
from app.models.technical_analysis import TechnicalAnalyzer
from research import ResearchConfig, clean_history, load_dataset, run
from backtest import Backtester, score, signal_precision


def config():
    return ResearchConfig("test-research", ["AAPL"], "2000-01-01", "2020-01-01", [7, 30], 3, 1500, 24, 42, 2)


def history():
    close = np.linspace(100, 200, 2000)
    return pd.DataFrame({"Open": close, "High": close + 1, "Low": close - 1,
                         "Close": close, "Volume": 1000.0},
                        index=pd.bdate_range("2000-01-03", periods=len(close), tz="America/New_York"))


@pytest.mark.parametrize("prices,expected", [(np.arange(40.0) + 10, 100),
                                             (100 - np.arange(40.0), 0),
                                             (np.repeat(100.0, 40), 50)])
def test_rsi_boundaries_preserve_current_rf_origin_and_warmup(prices, expected):
    close = pd.Series(prices)
    rsi = rolling_rsi(close)
    assert rsi.iloc[:14].isna().all()
    assert np.all(rsi.iloc[14:] == expected)
    assert TechnicalAnalyzer()._rsi(close).equals(rsi)
    frame = history().iloc[:300].copy()
    frame["Close"] = np.linspace(prices[0], prices[-1], len(frame))
    frame["Open"] = frame["Close"]
    frame["High"] = frame["Close"] + 1
    frame["Low"] = frame["Close"] - 1
    features = RandomForestPredictor()._create_features(frame)
    assert features.index[-1] == frame.index[-1]
    assert features["rsi_14"].iloc[-1] == expected


@pytest.mark.parametrize("bad", [np.nan, np.inf, -np.inf])
def test_missing_rsi_input_stays_unavailable_for_full_window(bad):
    close = pd.Series(np.arange(50.0) + 100)
    close.iloc[30] = bad
    result = rolling_rsi(close)
    assert result.iloc[30:45].isna().all()
    assert result.iloc[45] == 100


def test_rsi_mixed_changes_match_hand_calculation_and_are_causal():
    close = pd.Series([100, 102, 101, 104, 102, 104], dtype=float)
    rsi = rolling_rsi(close, 4)
    assert rsi.iloc[4] == pytest.approx(100 - 100 / (1 + 5 / 3))
    changed = close.copy()
    changed.iloc[-1] = 1000
    pd.testing.assert_series_equal(rolling_rsi(changed, 4).iloc[:-1], rsi.iloc[:-1])


@pytest.mark.parametrize("slope", [-0.05, 0.0, 0.05])
def test_rf_serves_sustained_falling_flat_and_rising_histories(slope):
    frame = history().iloc[:300].copy()
    frame["Close"] = 100 + slope * np.arange(len(frame))
    frame["Open"] = frame["Close"]
    frame["High"] = frame["Close"] + 1
    frame["Low"] = frame["Close"] - 1
    result = RandomForestPredictor(n_estimators=10).predict(frame, 7)
    assert result.get("fallback") is not True
    assert result["predicted_price"] > 0
    assert np.isfinite(result["predicted_price"])


@pytest.mark.parametrize("workers", [0, -1, True, 1.5, "2"])
def test_rf_and_research_worker_counts_are_explicit_positive_integers(workers):
    with pytest.raises(ValueError, match="positive integer"):
        RandomForestPredictor(n_jobs=workers)
    with pytest.raises(ValueError):
        Backtester({}, horizon=7, n_jobs=workers)


def test_directional_counts_do_not_call_flat_outcomes_down():
    result = score([0.01, -0.01, 0, 0.02], [0.02, 0, -0.03, -0.01])
    assert result["n_directional"] == 3
    assert result["n_correct_direction"] == 1
    assert result["n_predicted_no_change"] == 1
    assert result["n_realised_flat"] == 1
    assert result["base_up"] == 0.25
    assert result["base_down"] == 0.5
    assert result["base_flat"] == 0.25
    assert result["hit_rate"] == pytest.approx(1 / 3)
    sig = signal_precision([1, -1, 0, 1], [0.02, 0, -0.03, -0.01])
    assert sig["base_down"] == 0.5
    assert sig["base_flat"] == 0.25


def test_config_rejects_future_partial_sessions_and_unsafe_ids():
    with pytest.raises(ValueError, match="historical interval"):
        replace(config(), end_exclusive="9999-01-01").validate()
    with pytest.raises(ValueError, match="Ticker"):
        replace(config(), tickers=["../production"]).validate()
    with pytest.raises(ValueError, match="positive integers"):
        replace(config(), horizons_sessions=[True]).validate()


def test_dataset_uses_exact_cache_and_detects_tampering(tmp_path, monkeypatch):
    import research
    calls = []
    class Ticker:
        def history(self, **kwargs):
            calls.append(kwargs)
            return history()
    monkeypatch.setattr(research.yf, "Ticker", lambda _: Ticker())
    monkeypatch.setattr(research.yf, "set_tz_cache_location", lambda _: None)
    original, manifest = load_dataset(config(), tmp_path)
    cached, second_manifest = load_dataset(config(), tmp_path)
    assert len(calls) == 1
    assert calls[0]["auto_adjust"] is True
    assert calls[0]["end"] == "2020-01-01"
    assert calls[0]["interval"] == "1d"
    assert manifest == second_manifest
    pd.testing.assert_frame_equal(original["AAPL"], cached["AAPL"])
    with (tmp_path / "AAPL.csv").open("a") as stream:
        stream.write("corrupted\n")
    with pytest.raises(ValueError, match="hash mismatch"):
        load_dataset(config(), tmp_path)


def test_provider_cannot_silently_include_session_beyond_exclusive_end(tmp_path, monkeypatch):
    import research
    class Ticker:
        def history(self, **kwargs):
            frame = history()
            frame.index = pd.bdate_range("2019-01-01", periods=len(frame), tz="UTC")
            return frame
    monkeypatch.setattr(research.yf, "Ticker", lambda _: Ticker())
    monkeypatch.setattr(research.yf, "set_tz_cache_location", lambda _: None)
    with pytest.raises(ValueError, match="exclusive interval"):
        load_dataset(config(), tmp_path)


def test_dataset_excludes_invalid_prices_without_inventing_labels():
    frame = history()
    frame.iloc[1900, frame.columns.get_loc("Close")] = np.inf
    clean = clean_history(frame, config())
    assert len(clean) == len(frame) - 1
    assert frame.index[1900] not in clean.index
    duplicate = history()
    duplicate.index = duplicate.index.where(duplicate.index != duplicate.index[-1], duplicate.index[-2])
    with pytest.raises(ValueError, match="unique ordered"):
        clean_history(duplicate, config())


def test_research_refuses_deployment_or_unignored_output_before_download(tmp_path, monkeypatch):
    import research
    monkeypatch.setattr(research, "load_dataset", lambda *a: pytest.fail("No download before output validation"))
    with pytest.raises(ValueError, match="protect deployed artifacts"):
        run(config(), tmp_path)


def test_research_candidate_cannot_be_served_even_when_model_dir_points_to_it():
    from sklearn.dummy import DummyRegressor
    artifact = GradientBoostArtifact(DummyRegressor(), 180, (30, 6), 30)
    metadata = {"window_contract": WINDOW_CONTRACT, "horizon_days": 30,
                "backend": "sklearn", "sequence_length": 30, "n_features": 180}
    assert artifact_contract_reason(artifact, metadata, 30, 6, 30) is None
    assert artifact_contract_reason(artifact, {**metadata, "research_only": True}, 30, 6, 30) == "artifact_incompatible"
