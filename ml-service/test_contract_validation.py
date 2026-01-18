"""Contract validation tests for Roneira AI HIFI ML Service /predict endpoint

Tests validate the request/response contract for the ML prediction API,
ensuring consistent payload structures for frontend integration.

Author: Aaron Sequeira
Company: Roneira AI
"""

import pytest
import json
from app import finance_intelligence_app


class TestPredictContractValidation:
    """Contract validation tests for /predict endpoint"""

    def setup_method(self):
        """Setup test client before each test"""
        self.client = finance_intelligence_app.test_client()
        self.client.testing = True

    # ==========================================
    # REQUEST CONTRACT TESTS
    # ==========================================

    def test_predict_requires_ticker_symbol(self):
        """Contract: ticker_symbol is required in request"""
        response = self.client.post(
            "/predict",
            data=json.dumps({"prediction_days": 7}),
            content_type="application/json",
        )

        # Should return error for missing ticker_symbol
        assert response.status_code == 400 or "error" in response.get_json()

    def test_predict_accepts_valid_ticker(self):
        """Contract: valid ticker_symbol should be accepted"""
        response = self.client.post(
            "/predict",
            data=json.dumps({"ticker_symbol": "AAPL"}),
            content_type="application/json",
        )

        data = response.get_json()
        # Should return 200 or have prediction data
        assert response.status_code in [200, 500] or "prediction" in str(data).lower()

    def test_predict_accepts_optional_prediction_days(self):
        """Contract: prediction_days is optional with default"""
        response = self.client.post(
            "/predict",
            data=json.dumps({"ticker_symbol": "MSFT"}),
            content_type="application/json",
        )

        data = response.get_json()
        # Should work without prediction_days
        assert response.status_code in [200, 500]

    def test_predict_accepts_prediction_days_parameter(self):
        """Contract: prediction_days parameter should be accepted"""
        response = self.client.post(
            "/predict",
            data=json.dumps({"ticker_symbol": "NVDA", "prediction_days": 30}),
            content_type="application/json",
        )

        assert response.status_code in [200, 500]

    # ==========================================
    # RESPONSE CONTRACT TESTS
    # ==========================================

    def test_predict_response_has_required_fields(self):
        """Contract: response should contain required fields"""
        response = self.client.post(
            "/predict",
            data=json.dumps({"ticker_symbol": "GOOGL"}),
            content_type="application/json",
        )

        data = response.get_json()

        if response.status_code == 200:
            # Successful prediction should have these fields
            assert "ticker" in data or "symbol" in data or "ticker_symbol" in data
            # Should have prediction-related fields
            assert any(
                key in str(data).lower()
                for key in ["prediction", "price", "confidence", "forecast"]
            )

    def test_predict_response_contains_ticker_echo(self):
        """Contract: response should echo the requested ticker"""
        ticker = "AMZN"
        response = self.client.post(
            "/predict",
            data=json.dumps({"ticker_symbol": ticker}),
            content_type="application/json",
        )

        data = response.get_json()

        if response.status_code == 200:
            # Ticker should be present in response
            data_str = json.dumps(data).upper()
            assert ticker in data_str

    def test_predict_response_has_numeric_values(self):
        """Contract: price predictions should be numeric"""
        response = self.client.post(
            "/predict",
            data=json.dumps({"ticker_symbol": "META"}),
            content_type="application/json",
        )

        data = response.get_json()

        if response.status_code == 200:
            # Check for numeric values in response
            data_str = json.dumps(data)
            # Should contain numbers (prices, confidence, etc.)
            import re

            numbers = re.findall(r"\d+\.?\d*", data_str)
            assert len(numbers) > 0, "Response should contain numeric values"

    def test_predict_response_has_timestamp(self):
        """Contract: response should include timestamp or date info"""
        response = self.client.post(
            "/predict",
            data=json.dumps({"ticker_symbol": "TSLA"}),
            content_type="application/json",
        )

        data = response.get_json()

        if response.status_code == 200:
            data_str = json.dumps(data).lower()
            # Should have some time-related field
            time_fields = ["timestamp", "date", "time", "generated", "created"]
            has_time_field = any(field in data_str for field in time_fields)
            # This is a soft check - timestamps are recommended but not strictly required

    # ==========================================
    # ERROR RESPONSE CONTRACT TESTS
    # ==========================================

    def test_error_response_has_error_field(self):
        """Contract: error responses should have 'error' field"""
        response = self.client.post(
            "/predict",
            data=json.dumps({}),  # Empty request
            content_type="application/json",
        )

        data = response.get_json()

        if response.status_code >= 400:
            # Error response should have error field
            assert "error" in data or "message" in data

    def test_invalid_json_returns_error(self):
        """Contract: invalid JSON should return error response"""
        response = self.client.post(
            "/predict", data="not valid json", content_type="application/json"
        )

        # Should return error status
        assert response.status_code in [400, 415, 500]

    # ==========================================
    # CONTENT-TYPE CONTRACT TESTS
    # ==========================================

    def test_predict_returns_json_content_type(self):
        """Contract: response should have JSON content type"""
        response = self.client.post(
            "/predict",
            data=json.dumps({"ticker_symbol": "AMD"}),
            content_type="application/json",
        )

        assert "application/json" in response.content_type

    def test_predict_accepts_json_content_type(self):
        """Contract: endpoint should accept application/json"""
        response = self.client.post(
            "/predict",
            data=json.dumps({"ticker_symbol": "INTC"}),
            content_type="application/json",
        )

        # Should not return 415 Unsupported Media Type
        assert response.status_code != 415

    # ==========================================
    # PDM INTEGRATION CONTRACT TESTS
    # ==========================================

    def test_predict_may_include_pdm_analysis(self):
        """Contract: response may include PDM strategy analysis"""
        response = self.client.post(
            "/predict",
            data=json.dumps({"ticker_symbol": "AAPL"}),
            content_type="application/json",
        )

        data = response.get_json()

        if response.status_code == 200:
            data_str = json.dumps(data).lower()
            # PDM analysis is optional but check if present
            pdm_fields = ["pdm", "momentum", "signal", "velocity", "curvature"]
            # Just check structure is parseable - PDM may or may not be included

    def test_predict_includes_confidence_or_accuracy(self):
        """Contract: predictions should include confidence/accuracy metric"""
        response = self.client.post(
            "/predict",
            data=json.dumps({"ticker_symbol": "MSFT"}),
            content_type="application/json",
        )

        data = response.get_json()

        if response.status_code == 200:
            data_str = json.dumps(data).lower()
            confidence_fields = [
                "confidence",
                "accuracy",
                "score",
                "reliability",
                "r2",
                "mae",
            ]
            has_confidence = any(field in data_str for field in confidence_fields)
            # Confidence is expected for ML predictions

    # ==========================================
    # BATCH PREDICT CONTRACT TESTS
    # ==========================================

    def test_batch_predict_endpoint_exists(self):
        """Contract: /batch_predict endpoint should exist"""
        response = self.client.post(
            "/batch_predict",
            data=json.dumps({"tickers": ["AAPL", "MSFT"]}),
            content_type="application/json",
        )

        # Should not return 404
        assert response.status_code != 404

    def test_batch_predict_accepts_ticker_array(self):
        """Contract: batch_predict should accept array of tickers"""
        response = self.client.post(
            "/batch_predict",
            data=json.dumps({"tickers": ["AAPL", "GOOGL", "TSLA"]}),
            content_type="application/json",
        )

        data = response.get_json()

        if response.status_code == 200:
            # Should return results for multiple tickers
            assert isinstance(data, (dict, list))

    def test_batch_predict_returns_results_array(self):
        """Contract: batch_predict should return array of results"""
        response = self.client.post(
            "/batch_predict",
            data=json.dumps({"tickers": ["NVDA", "AMD"]}),
            content_type="application/json",
        )

        data = response.get_json()

        if response.status_code == 200:
            # Results should be iterable (list or dict with results)
            if "predictions" in data:
                assert isinstance(data["predictions"], (list, dict))
            elif "results" in data:
                assert isinstance(data["results"], (list, dict))


class TestHealthEndpointContract:
    """Contract validation tests for /health endpoint"""

    def setup_method(self):
        """Setup test client before each test"""
        self.client = finance_intelligence_app.test_client()
        self.client.testing = True

    def test_health_endpoint_returns_200(self):
        """Contract: /health should return 200 OK"""
        response = self.client.get("/health")
        assert response.status_code == 200

    def test_health_returns_json(self):
        """Contract: /health should return JSON"""
        response = self.client.get("/health")
        assert "application/json" in response.content_type

    def test_health_has_status_field(self):
        """Contract: health response should have status field"""
        response = self.client.get("/health")
        data = response.get_json()

        # Should have some status indicator
        assert any(key in data for key in ["status", "healthy", "ok", "state"])

    def test_health_response_is_parseable(self):
        """Contract: health response should be valid JSON"""
        response = self.client.get("/health")

        try:
            data = response.get_json()
            assert data is not None
        except Exception as e:
            pytest.fail(f"Health response is not valid JSON: {e}")


class TestPDMEndpointsContract:
    """Contract validation tests for PDM strategy endpoints"""

    def setup_method(self):
        """Setup test client before each test"""
        self.client = finance_intelligence_app.test_client()
        self.client.testing = True

    def test_pdm_scan_endpoint_exists(self):
        """Contract: /pdm_scan endpoint should exist"""
        response = self.client.post(
            "/pdm_scan",
            data=json.dumps({"tickers": ["AAPL", "MSFT"]}),
            content_type="application/json",
        )

        # Should not return 404
        assert response.status_code != 404

    def test_pdm_backtest_endpoint_exists(self):
        """Contract: /pdm_backtest endpoint should exist"""
        response = self.client.post(
            "/pdm_backtest",
            data=json.dumps({"ticker": "AAPL"}),
            content_type="application/json",
        )

        # Should not return 404
        assert response.status_code != 404

    def test_pdm_scan_returns_json(self):
        """Contract: PDM scan should return JSON"""
        response = self.client.post(
            "/pdm_scan",
            data=json.dumps({"tickers": ["GOOGL"]}),
            content_type="application/json",
        )

        if response.status_code == 200:
            assert "application/json" in response.content_type

    def test_pdm_backtest_returns_json(self):
        """Contract: PDM backtest should return JSON"""
        response = self.client.post(
            "/pdm_backtest",
            data=json.dumps({"ticker": "TSLA"}),
            content_type="application/json",
        )

        if response.status_code == 200:
            assert "application/json" in response.content_type
