"""Tests for enhanced_app.py endpoints"""

import pytest
import json
from enhanced_app import app

class TestEnhancedApp:
    def setup_method(self):
        self.client = app.test_client()
        self.client.testing = True

    def test_batch_predict_empty_list(self):
        """Test batch_predict endpoint with an empty list of tickers"""
        response = self.client.post(
            "/batch_predict",
            json={"tickers": []},
            content_type="application/json",
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data
        assert data["error"] == "Ticker list is required"
