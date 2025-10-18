"""Comprehensive test suite for Roneira AI HIFI ML Service

Tests cover:
1. PDM Strategy Engine functionality
2. Stock prediction endpoints
3. Technical indicators calculation
4. Error handling and edge cases

Author: Aaron Sequeira
Company: Roneira AI
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import json

# Import our modules
from app import finance_intelligence_app, StockDataProcessor, SentimentAnalysisService
from pdm_strategy_engine import PriceVolumeDerivativesEngine, PDMSignal

class TestPDMStrategyEngine:
    """Test suite for Price-Volume Derivatives Momentum Strategy Engine"""
    
    def setup_method(self):
        """Setup test environment before each test"""
        self.pdm_engine = PriceVolumeDerivativesEngine(
            lookback_period=100,
            min_liquidity=500_000
        )
        
        # Create sample stock data for testing
        dates = pd.date_range('2023-01-01', periods=100, freq='D')
        self.sample_stock_data = pd.DataFrame({
            'Close': np.random.uniform(100, 200, 100) + np.arange(100) * 0.5,
            'High': np.random.uniform(105, 205, 100) + np.arange(100) * 0.5,
            'Low': np.random.uniform(95, 195, 100) + np.arange(100) * 0.5,
            'Volume': np.random.uniform(1_000_000, 5_000_000, 100)
        }, index=dates)
    
    def test_price_velocity_calculation(self):
        """Test price velocity (df/dt) calculation"""
        price_series = pd.Series([100, 101, 103, 102, 105])
        velocity = self.pdm_engine.calculate_price_velocity(price_series)
        
        expected_velocity = pd.Series([np.nan, 1.0, 2.0, -1.0, 3.0])
        pd.testing.assert_series_equal(velocity, expected_velocity, check_names=False)
    
    def test_price_curvature_calculation(self):
        """Test price curvature (d²f/dt²) calculation"""
        price_series = pd.Series([100, 101, 103, 102, 105])
        curvature = self.pdm_engine.calculate_price_curvature(price_series)
        
        # Curvature should be second derivative
        assert len(curvature) == len(price_series)
        assert not np.isnan(curvature.iloc[2])  # Third point should have valid curvature
    
    def test_volume_sensitivity_calculation(self):
        """Test volume sensitivity (df/dV) calculation"""
        price_series = pd.Series([100, 102, 101, 104, 103])
        volume_series = pd.Series([1000, 1200, 800, 1500, 1100])
        
        volume_sensitivity = self.pdm_engine.calculate_volume_sensitivity(price_series, volume_series)
        
        assert len(volume_sensitivity) == len(price_series)
        assert not np.isinf(volume_sensitivity.iloc[-1])  # Should handle division properly
    
    def test_moving_averages_calculation(self):
        """Test moving averages calculation"""
        price_series = pd.Series(range(1, 51))  # 1 to 50
        
        moving_averages = self.pdm_engine.calculate_moving_averages(price_series)
        
        assert 'sma_20' in moving_averages
        assert 'sma_200' in moving_averages
        
        # SMA_20 at position 19 should be average of first 20 values
        expected_sma_20 = sum(range(1, 21)) / 20
        assert abs(moving_averages['sma_20'].iloc[19] - expected_sma_20) < 0.001
    
    def test_atr_calculation(self):
        """Test Average True Range calculation"""
        high_series = self.sample_stock_data['High']
        low_series = self.sample_stock_data['Low']
        close_series = self.sample_stock_data['Close']
        
        atr = self.pdm_engine.calculate_average_true_range(high_series, low_series, close_series)
        
        assert len(atr) == len(close_series)
        assert atr.iloc[-1] > 0  # ATR should be positive
    
    def test_institutional_volume_detection(self):
        """Test institutional volume participation detection"""
        volume_series = self.sample_stock_data['Volume']
        price_series = self.sample_stock_data['Close']
        
        institutional_factor = self.pdm_engine.detect_institutional_volume_participation(
            volume_series, price_series
        )
        
        assert len(institutional_factor) == len(volume_series)
        assert all(institutional_factor >= 0)  # Should be non-negative
    
    def test_liquidity_filtering(self):
        """Test stock liquidity filtering"""
        test_symbols = ['AAPL', 'INVALID_SYMBOL', 'GOOGL']
        
        with patch('yfinance.download') as mock_download:
            # Mock successful download for AAPL
            mock_download.side_effect = [
                pd.DataFrame({
                    'Close': [150] * 30,
                    'Volume': [2_000_000] * 30
                }),
                pd.DataFrame(),  # Empty for invalid symbol
                pd.DataFrame({
                    'Close': [2800] * 30,
                    'Volume': [500_000] * 30  # Below liquidity threshold
                })
            ]
            
            filtered_stocks = self.pdm_engine.filter_stocks_by_liquidity(test_symbols)
            
            # Only AAPL should pass (high volume * reasonable price)
            assert 'AAPL' in filtered_stocks
            assert len(filtered_stocks) <= len(test_symbols)

class TestStockDataProcessor:
    """Test suite for Stock Data Processing functionality"""
    
    def setup_method(self):
        """Setup test environment"""
        self.processor = StockDataProcessor()
        
        # Create sample stock data
        dates = pd.date_range('2023-01-01', periods=50, freq='D')
        self.sample_data = pd.DataFrame({
            'Close': np.random.uniform(100, 200, 50),
            'High': np.random.uniform(105, 205, 50),
            'Low': np.random.uniform(95, 195, 50),
            'Open': np.random.uniform(98, 198, 50),
            'Volume': np.random.uniform(1_000_000, 5_000_000, 50)
        }, index=dates)
    
    def test_technical_indicators_calculation(self):
        """Test calculation of various technical indicators"""
        result = self.processor.calculate_technical_indicators(self.sample_data)
        
        expected_indicators = [
            'simple_moving_average_5',
            'simple_moving_average_20',
            'relative_strength_index',
            'macd_line',
            'bollinger_band_upper',
            'bollinger_band_lower',
            'volume_ratio'
        ]
        
        for indicator in expected_indicators:
            assert indicator in result.columns
    
    def test_rsi_calculation_bounds(self):
        """Test that RSI values are within valid bounds (0-100)"""
        result = self.processor.calculate_technical_indicators(self.sample_data)
        
        rsi_values = result['relative_strength_index'].dropna()
        assert all(0 <= value <= 100 for value in rsi_values)
    
    @patch('yfinance.download')
    def test_fetch_historical_data_success(self, mock_download):
        """Test successful historical data fetching"""
        mock_download.return_value = self.sample_data
        
        result = self.processor.fetch_historical_stock_data('AAPL', '2023-01-01', '2023-12-31')
        
        assert result is not None
        assert len(result) == 50
    
    @patch('yfinance.download')
    def test_fetch_historical_data_empty(self, mock_download):
        """Test handling of empty data response"""
        mock_download.return_value = pd.DataFrame()
        
        result = self.processor.fetch_historical_stock_data('INVALID', '2023-01-01', '2023-12-31')
        
        assert result is None

class TestSentimentAnalysisService:
    """Test suite for Sentiment Analysis Service"""
    
    def setup_method(self):
        """Setup test environment"""
        self.sentiment_service = SentimentAnalysisService('fake_api_key')
    
    @patch('requests.post')
    def test_sentiment_analysis_success(self, mock_post):
        """Test successful sentiment analysis"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = [{'label': 'POSITIVE', 'score': 0.8}]
        mock_post.return_value = mock_response
        
        result = self.sentiment_service.analyze_stock_sentiment('AAPL', 'Apple Inc.')
        
        assert result['label'] == 'POSITIVE'
        assert result['score'] == 0.8
    
    @patch('requests.post')
    def test_sentiment_analysis_api_failure(self, mock_post):
        """Test handling of API failure"""
        mock_post.side_effect = Exception("API Error")
        
        result = self.sentiment_service.analyze_stock_sentiment('AAPL', 'Apple Inc.')
        
        assert result['label'] == 'NEUTRAL'
        assert result['score'] == 0.5

class TestFlaskApplication:
    """Test suite for Flask application endpoints"""
    
    def setup_method(self):
        """Setup test Flask client"""
        finance_intelligence_app.config['TESTING'] = True
        self.client = finance_intelligence_app.test_client()
    
    def test_health_check_endpoint(self):
        """Test health check endpoint"""
        response = self.client.get('/health')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['service_status'] == 'healthy'
        assert 'timestamp' in data
    
    @patch('app.model_trainer.train_random_forest_model')
    @patch('yfinance.download')
    def test_predict_endpoint_success(self, mock_download, mock_train):
        """Test successful stock prediction"""
        # Mock training data
        dates = pd.date_range('2023-01-01', periods=100, freq='D')
        mock_stock_data = pd.DataFrame({
            'Close': np.random.uniform(100, 200, 100),
            'High': np.random.uniform(105, 205, 100),
            'Low': np.random.uniform(95, 195, 100),
            'Open': np.random.uniform(98, 198, 100),
            'Volume': np.random.uniform(1_000_000, 5_000_000, 100)
        }, index=dates)
        
        mock_download.return_value = mock_stock_data
        
        # Mock trained model
        mock_model = Mock()
        mock_model.predict.return_value = [150.0]
        
        mock_train.return_value = {
            'trained_model': mock_model,
            'feature_names': ['Open', 'High', 'Low', 'Volume'],
            'testing_r2_score': 0.85
        }
        
        response = self.client.post('/predict', 
            json={'ticker': 'AAPL', 'include_pdm': False},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'ticker_symbol' in data
        assert 'ml_predicted_price' in data
    
    def test_predict_endpoint_missing_ticker(self):
        """Test prediction endpoint with missing ticker"""
        response = self.client.post('/predict', 
            json={},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
    
    def test_batch_predict_endpoint_empty_list(self):
        """Test batch prediction with empty ticker list"""
        response = self.client.post('/batch_predict',
            json={'tickers': []},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
    
    def test_batch_predict_endpoint_too_many_tickers(self):
        """Test batch prediction with too many tickers"""
        large_ticker_list = ['STOCK' + str(i) for i in range(15)]  # More than max allowed
        
        response = self.client.post('/batch_predict',
            json={'tickers': large_ticker_list},
            content_type='application/json'
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'Maximum' in data['error']
    
    @patch('app.pdm_strategy_engine.scan_universe_for_opportunities')
    def test_pdm_scan_endpoint(self, mock_scan):
        """Test PDM opportunity scanning endpoint"""
        mock_signal = PDMSignal(
            symbol='AAPL',
            signal_type='LONG',
            price=150.0,
            timestamp=datetime.now(),
            price_velocity=1.5,
            price_curvature=-0.2,
            volume_sensitivity=0.001,
            atr_stop_loss=145.0,
            trailing_stop=140.0,
            confidence_score=0.85,
            institutional_volume_factor=1.8
        )
        
        mock_scan.return_value = [mock_signal]
        
        response = self.client.get('/pdm_scan')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['opportunities_found'] == 1
        assert len(data['pdm_signals']) == 1
        assert data['pdm_signals'][0]['ticker_symbol'] == 'AAPL'
    
    @patch('app.pdm_strategy_engine.backtest_pdm_strategy')
    def test_pdm_backtest_endpoint(self, mock_backtest):
        """Test PDM backtesting endpoint"""
        mock_backtest.return_value = {
            'strategy_return': '42.8%',
            'benchmark_return': '7.1%',
            'outperformance': '35.7%'
        }
        
        response = self.client.post('/pdm_backtest',
            json={'start_date': '2025-04-01', 'end_date': '2025-10-01'},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'backtest_results' in data
        assert data['backtest_results']['strategy_return'] == '42.8%'
    
    def test_404_handler(self):
        """Test 404 error handling"""
        response = self.client.get('/nonexistent_endpoint')
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert 'error' in data
        assert 'available_endpoints' in data

class TestIntegrationScenarios:
    """Integration tests for complete workflow scenarios"""
    
    def setup_method(self):
        """Setup integration test environment"""
        finance_intelligence_app.config['TESTING'] = True
        self.client = finance_intelligence_app.test_client()
        self.pdm_engine = PriceVolumeDerivativesEngine()
    
    @patch('yfinance.download')
    @patch('app.pdm_strategy_engine.generate_pdm_signals')
    def test_full_prediction_workflow_with_pdm(self, mock_pdm_signals, mock_download):
        """Test complete prediction workflow including PDM analysis"""
        # Mock stock data
        dates = pd.date_range('2023-01-01', periods=100, freq='D')
        mock_stock_data = pd.DataFrame({
            'Close': np.linspace(100, 150, 100),
            'High': np.linspace(105, 155, 100),
            'Low': np.linspace(95, 145, 100),
            'Open': np.linspace(98, 148, 100),
            'Volume': np.random.uniform(1_000_000, 3_000_000, 100)
        }, index=dates)
        
        mock_download.return_value = mock_stock_data
        
        # Mock PDM signal
        mock_pdm_signal = PDMSignal(
            symbol='AAPL',
            signal_type='LONG',
            price=150.0,
            timestamp=datetime.now(),
            price_velocity=2.0,
            price_curvature=-0.5,
            volume_sensitivity=0.002,
            atr_stop_loss=145.0,
            trailing_stop=140.0,
            confidence_score=0.90,
            institutional_volume_factor=2.1
        )
        
        mock_pdm_signals.return_value = mock_pdm_signal
        
        response = self.client.post('/predict',
            json={'ticker': 'AAPL', 'include_pdm': True},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        # Verify standard prediction fields
        assert 'ticker_symbol' in data
        assert 'ml_predicted_price' in data
        assert 'technical_indicators' in data
        
        # Verify PDM analysis is included
        assert 'pdm_strategy_analysis' in data
        assert data['pdm_strategy_analysis']['signal_type'] == 'LONG'
        assert data['pdm_strategy_analysis']['confidence_score'] == 0.90

if __name__ == '__main__':
    # Run tests with coverage
    pytest.main([
        '-v',
        '--cov=app',
        '--cov=pdm_strategy_engine', 
        '--cov-report=html',
        '--cov-report=term-missing',
        'test_ml_service.py'
    ])