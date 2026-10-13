"""Contract regressions across the actual private API and model combiner."""
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.horizons import history_period, serving_lookback
from app.models.ensemble import EnsembleCombiner
from app.models.random_forest import RandomForestPredictor


@pytest.fixture
def prediction_api(monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "ML_SERVICE_TOKEN", "test-service-token")
    index = pd.bdate_range("2014-01-01", periods=3000, tz="Asia/Kolkata")
    close = np.linspace(100, 200, len(index))
    frame = pd.DataFrame({"Open": close, "High": close + 1, "Low": close - 1,
                          "Close": close, "Volume": 1000}, index=index)
    fetched = []
    monkeypatch.setattr(main, "fetch_stock_data", lambda ticker, period: fetched.append(period) or frame)
    monkeypatch.setattr(main, "get_company_info", lambda ticker: {"name": ticker})
    return main, TestClient(main.app), frame, fetched


def request(client, **overrides):
    return client.post("/predict", headers={"X-ML-Service-Token": "test-service-token"},
                       json={"ticker": "TCS.NS", "timeframe": "1month", "model_type": "RANDOM_FOREST", **overrides})


@pytest.mark.parametrize("horizon,period", [(1, "5y"), (30, "5y"), (180, "5y"), (400, "10y")])
def test_history_policy_allows_resolved_training_labels(horizon, period):
    assert serving_lookback(horizon) >= 4 * horizon + 200
    assert history_period(horizon) == period


def test_api_uses_history_policy_and_reports_provider_session(prediction_api, monkeypatch):
    main, client, frame, fetched = prediction_api
    windows = []

    def predict(history, horizon):
        windows.append((len(history), horizon))
        return {"predicted_price": 205.0, "confidence": 40.0}

    monkeypatch.setattr(main.rf_predictor, "predict", predict)
    response = request(client, timeframe="6month")
    assert response.status_code == 200
    body = response.json()
    assert fetched == ["5y"]
    assert windows == [(920, 180)]
    assert body["history_sessions"] == 920
    assert body["horizon_sessions"] == 180
    assert body["data_session_date"] == frame.index[-1].strftime("%Y-%m-%d")
    assert body["data_session_timezone"] == "Asia/Kolkata"
    assert body["model_status"] == {"backend": "random_forest", "requested_horizon_sessions": 180,
                                    "trained_horizon_sessions": 180, "fallback": False, "fallback_reason": None}


def test_direct_fallback_is_not_framed_as_success(prediction_api, monkeypatch):
    main, client, frame, _ = prediction_api
    monkeypatch.setattr(main.rf_predictor, "predict", lambda *_: {
        "predicted_price": 200.0, "confidence": 30.0, "fallback": True,
        "fallback_reason": "insufficient_history"})
    body = request(client).json()
    assert body["fallback"] is True
    assert body["fallback_reason"] == "insufficient_history"
    assert body["confidence"] == 0
    assert body["predicted_price"] == body["current_price"] == frame["Close"].iloc[-1]
    assert body["price_target_low"] == body["price_target_high"] == body["current_price"]
    assert body["short_term_signal"] == {"signal": "HOLD", "score": 5.0}
    assert body["long_term_signal"] == {"signal": "HOLD", "score": 5.0}


def test_api_ensemble_excludes_unsupported_artifact(prediction_api, monkeypatch):
    main, client, _, _ = prediction_api
    monkeypatch.setattr(main.rf_predictor, "predict", lambda *_: {"predicted_price": 210., "confidence": 40.})
    monkeypatch.setattr(main.ta_analyzer, "analyze", lambda *_: {"predicted_price": 220., "confidence": 50.})
    monkeypatch.setattr(main.pdm_engine, "analyze", lambda *_: {"predicted_price": 230., "confidence": 60.})
    monkeypatch.setattr(main.lstm_predictor, "predict", lambda *_: {
        "predicted_price": 200., "confidence": 0., "fallback": True,
        "fallback_reason": "horizon_mismatch", "trained_horizon_sessions": 30, "backend": "xgboost"})
    body = request(client, timeframe="1week", model_type="ENSEMBLE").json()
    assert body["predicted_price"] == 220
    assert body["confidence"] == 50  # no agreement premium
    assert [c["name"] for c in body["components"]] == ["RANDOM_FOREST", "TECHNICAL", "PVD_MOMENTUM"]
    assert all(c["weight"] == pytest.approx(1 / 3, abs=.001) for c in body["components"])
    assert body["excluded_components"] == [{"name": "LSTM", "reason": "horizon_mismatch", "trained_horizon_sessions": 30}]
    assert body["fallback"] is False


@pytest.mark.parametrize("overrides", [{"timeframe": "bogus"}, {"model_type": "FUNDAMENTAL"}, {"ticker": ""}])
def test_invalid_requests_never_fetch(prediction_api, overrides):
    _, client, _, fetched = prediction_api
    assert request(client, **overrides).status_code == 422
    assert fetched == []


def test_all_fallback_members_produce_one_disclosed_reference():
    combined = EnsembleCombiner().combine([
        {"predicted_price": 200., "confidence": 0., "fallback": True, "fallback_reason": "artifact_unavailable"},
        {"predicted_price": 200., "confidence": 0., "fallback": True, "fallback_reason": "insufficient_history"},
    ], weights=[.5, .5], names=["LSTM", "RANDOM_FOREST"])
    assert combined["predicted_price"] == 200
    assert combined["confidence"] == 0
    assert combined["fallback_reason"] == "no_eligible_models"
    assert combined["components"] == []
    assert len(combined["excluded_components"]) == 2
    assert combined["agreement_score"] is None


def test_nonfinite_target_is_not_included_in_blend():
    combined = EnsembleCombiner().combine([
        {"predicted_price": np.inf}, {"predicted_price": 200., "confidence": 40.}
    ], names=["bad", "good"])
    assert combined["predicted_price"] == 200
    assert len(combined["components"]) == 1
    assert combined["excluded_components"][0]["reason"] == "invalid_input"


def test_random_forest_never_anchors_old_features_to_the_latest_close():
    index = pd.bdate_range("2022-01-03", periods=504)
    rng = np.random.default_rng(42)
    close = 100 * np.exp(np.cumsum(rng.normal(0, .01, len(index))))
    close[-20:] = close[-21] * np.linspace(1.01, 1.2, 20)
    frame = pd.DataFrame({"Open": close, "High": close + 1, "Low": close - 1,
                          "Close": close, "Volume": 1000}, index=index)
    predictor = RandomForestPredictor()
    features = predictor._create_features(frame)
    assert len(features) > 50  # Enough older rows; only the current origin is invalid.
    assert features.index[-1] < index[-1]
    result = predictor.predict(frame, 30)
    assert result["fallback_reason"] == "invalid_input"
    assert result["fallback"] is True
    assert result["predicted_price"] == close[-1]
    assert result["confidence"] == 0


@pytest.mark.parametrize("invalid", [None, "invalid", np.inf])
def test_entirely_invalid_blend_never_raises_or_invents_a_price(invalid):
    result = EnsembleCombiner().combine([{"predicted_price": invalid}], names=["bad"])
    assert result["fallback_reason"] == "no_eligible_models"
    assert result["predicted_price"] == 0  # API refuses an absent numeric reference.
    assert result["components"] == []
