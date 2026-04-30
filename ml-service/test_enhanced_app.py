import pytest
from unittest.mock import Mock, patch
from enhanced_app import get_stock_sentiment

class TestEnhancedApp:
    @patch("enhanced_app.requests.post")
    def test_get_stock_sentiment_api_failure_status(self, mock_post):
        """Test handling when API returns a non-200 status code."""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_post.return_value = mock_response

        result = get_stock_sentiment("INVALID", "Invalid Company")

        mock_post.assert_called_once()
        assert result == {"label": "NEUTRAL", "score": 0.5}

    @patch("enhanced_app.requests.post")
    def test_get_stock_sentiment_empty_response(self, mock_post):
        """Test handling when API returns 200 but response json is empty."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = []
        mock_post.return_value = mock_response

        result = get_stock_sentiment("INVALID", "Invalid Company")

        mock_post.assert_called_once()
        assert result == {"label": "NEUTRAL", "score": 0.5}

    @patch("enhanced_app.requests.post")
    def test_get_stock_sentiment_exception(self, mock_post):
        """Test handling when requests.post throws an exception."""
        mock_post.side_effect = Exception("Connection Timeout")

        result = get_stock_sentiment("INVALID", "Invalid Company")

        mock_post.assert_called_once()
        assert result == {"label": "NEUTRAL", "score": 0.5}
