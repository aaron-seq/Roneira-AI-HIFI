import pytest
import json
from unittest.mock import patch, MagicMock
from enhanced_app import app

class TestEnhancedAppBatchPredict:
    def setup_method(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_batch_predict_empty_list(self):
        """Test batch_predict with empty list"""
        response = self.client.post(
            "/batch_predict",
            json={"tickers": []},
            content_type="application/json"
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data
        assert data["error"] == "Ticker list is required"

    def test_batch_predict_no_tickers_key(self):
        """Test batch_predict with no tickers key in JSON"""
        response = self.client.post(
            "/batch_predict",
            json={},
            content_type="application/json"
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data
        assert data["error"] == "Ticker list is required"
