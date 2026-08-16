"""
Roneira AI HIFI — real FastAPI entrypoint smoke test.

Why this file exists: `test_models.py` imports the model classes directly
(`app.models.random_forest`, etc.) and never touches `app.main`, so a broken
import in the actual ASGI app -- a dependency listed in requirements.txt but
not installed, a bad top-level import, a startup-time exception -- passes the
rest of the suite silently and is only caught by hand-running `ml:dev`. This
test imports `app.main:app` for real and exercises it with FastAPI's
TestClient, so dependency-drift bugs like a missing `pydantic`/`fastapi`
install fail CI instead of surfacing later as a 502 from the Next.js
`/api/predict` route.
"""
from fastapi.testclient import TestClient


def test_app_imports_and_boots():
    """The real entrypoint must import without raising."""
    from app.main import app

    assert app is not None


def test_root_endpoint_reports_expected_shape():
    from app.main import app

    client = TestClient(app)
    response = client.get("/")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "operational"
    assert "RANDOM_FOREST" in body["models"]


def test_health_endpoint_reports_model_load_state():
    from app.main import app

    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    # LSTM/GAN degrade to a fallback (no TensorFlow / no artifacts) rather
    # than crashing the app -- assert the key exists, not that it's True,
    # since "is_ready() == False" is an expected, non-broken state here.
    assert set(body["models_loaded"].keys()) == {
        "random_forest",
        "lstm",
        "gan",
        "technical",
        "pdm_momentum",
        "ensemble",
    }


# ========== Service token (see ml/.env.example) ==========
# These cover the auth boundary itself, not the handlers behind it: the
# dependency runs before the route body, so a rejected request never reaches
# yfinance and these stay fast and network-free.

def test_protected_endpoint_rejects_missing_token(monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "ML_SERVICE_TOKEN", "test-secret")
    client = TestClient(main.app)

    response = client.get("/market-data?symbols=AAPL")

    assert response.status_code == 401


def test_protected_endpoint_rejects_wrong_token(monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "ML_SERVICE_TOKEN", "test-secret")
    client = TestClient(main.app)

    response = client.get(
        "/market-data?symbols=AAPL",
        headers={"X-ML-Service-Token": "wrong-secret"},
    )

    assert response.status_code == 401


def test_valid_token_passes_the_dependency(monkeypatch):
    """The correct token must not raise.

    Asserted against the dependency directly rather than through a route, so
    the test does not depend on yfinance being reachable.
    """
    import app.main as main

    monkeypatch.setattr(main, "ML_SERVICE_TOKEN", "test-secret")

    assert main.require_service_token("test-secret") is None


def test_unset_token_fails_closed(monkeypatch):
    """An unconfigured deployment must reject, not silently run open."""
    import pytest
    from fastapi import HTTPException
    import app.main as main

    monkeypatch.setattr(main, "ML_SERVICE_TOKEN", "")

    with pytest.raises(HTTPException) as excinfo:
        main.require_service_token("anything")

    assert excinfo.value.status_code == 503


def test_health_stays_open_without_a_token(monkeypatch):
    """Platform health checks cannot send custom headers."""
    import app.main as main

    monkeypatch.setattr(main, "ML_SERVICE_TOKEN", "test-secret")
    client = TestClient(main.app)

    assert client.get("/health").status_code == 200
    assert client.get("/").status_code == 200
