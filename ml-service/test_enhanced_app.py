import pytest
import json
from enhanced_app import app

class TestEnhancedApp:
    def setup_method(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_batch_predict_endpoint_empty_list(self):
        """Test batch prediction with empty ticker list in enhanced_app"""
        response = self.client.post(
            "/batch_predict", json={"tickers": []}, content_type="application/json"
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data
