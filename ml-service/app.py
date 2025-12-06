"""Roneira AI HIFI - Enhanced ML Service with PDM Strategy

This service provides advanced stock price predictions using:
1. Traditional ML models (LSTM, Random Forest)
2. Price-Volume Derivatives Momentum (PDM) Strategy
3. Technical indicators and sentiment analysis

Author: Aaron Sequeira
Company: Roneira AI
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import warnings

import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
import requests

# Import our custom PDM strategy engine
from pdm_strategy_engine import PriceVolumeDerivativesEngine, PDMSignal

warnings.filterwarnings("ignore")

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize Flask application
finance_intelligence_app = Flask(__name__)
CORS(finance_intelligence_app, origins="*")


# Configuration
class ApplicationConfiguration:
    """Centralized configuration for the ML service"""

    def __init__(self):
        self.hugging_face_api_key = os.getenv("HUGGING_FACE_API_KEY", "")
        self.alpha_vantage_api_key = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")
        self.prediction_cache_timeout_seconds = 300  # 5 minutes
        self.max_batch_prediction_size = 10
        self.default_prediction_days = 1
        self.model_training_lookback_days = 730  # 2 years


app_config = ApplicationConfiguration()

# Global caches
model_performance_cache: Dict[str, Dict[str, Any]] = {}
prediction_results_cache: Dict[str, Dict[str, Any]] = {}

# Initialize PDM Strategy Engine
pdm_strategy_engine = PriceVolumeDerivativesEngine(
    lookback_period=252, min_liquidity=1_000_000
)


class StockDataProcessor:
    """Handles stock data processing and feature engineering"""

    @staticmethod
    def fetch_historical_stock_data(
        ticker_symbol: str, start_date: str, end_date: str
    ) -> Optional[pd.DataFrame]:
        """Fetch historical stock data from Yahoo Finance"""
        try:
            stock_data = yf.download(ticker_symbol, start=start_date, end=end_date)
            if stock_data.empty:
                logger.warning(f"No historical data found for {ticker_symbol}")
                return None
            return stock_data
        except Exception as e:
            logger.error(f"Error fetching data for {ticker_symbol}: {e}")
            return None

    @staticmethod
    def calculate_technical_indicators(stock_data: pd.DataFrame) -> pd.DataFrame:
        """Calculate comprehensive technical indicators for better predictions"""
        try:
            # Simple Moving Averages
            stock_data["simple_moving_average_5"] = (
                stock_data["Close"].rolling(window=5).mean()
            )
            stock_data["simple_moving_average_20"] = (
                stock_data["Close"].rolling(window=20).mean()
            )
            stock_data["simple_moving_average_50"] = (
                stock_data["Close"].rolling(window=50).mean()
            )

            # Exponential Moving Averages
            stock_data["exponential_moving_average_12"] = (
                stock_data["Close"].ewm(span=12).mean()
            )
            stock_data["exponential_moving_average_26"] = (
                stock_data["Close"].ewm(span=26).mean()
            )

            # RSI (Relative Strength Index)
            delta = stock_data["Close"].diff()
            gain = (delta.where(delta > 0, 0)).ewm(alpha=1 / 14, adjust=False).mean()
            loss = (-delta.where(delta < 0, 0)).ewm(alpha=1 / 14, adjust=False).mean()
            rs = gain / loss
            stock_data["relative_strength_index"] = 100 - (100 / (1 + rs))

            # MACD (Moving Average Convergence Divergence)
            macd_line = (
                stock_data["exponential_moving_average_12"]
                - stock_data["exponential_moving_average_26"]
            )
            stock_data["macd_line"] = macd_line
            stock_data["macd_signal_line"] = macd_line.ewm(span=9).mean()
            stock_data["macd_histogram"] = macd_line - stock_data["macd_signal_line"]

            # Bollinger Bands
            bollinger_middle = stock_data["Close"].rolling(window=20).mean()
            bollinger_std = stock_data["Close"].rolling(window=20).std()
            stock_data["bollinger_band_upper"] = bollinger_middle + (bollinger_std * 2)
            stock_data["bollinger_band_lower"] = bollinger_middle - (bollinger_std * 2)
            stock_data["bollinger_band_middle"] = bollinger_middle

            # Price Position within Bollinger Bands
            stock_data["bollinger_position"] = (
                stock_data["Close"] - stock_data["bollinger_band_lower"]
            ) / (
                stock_data["bollinger_band_upper"] - stock_data["bollinger_band_lower"]
            )

            # Volume indicators
            stock_data["volume_moving_average_20"] = (
                stock_data["Volume"].rolling(window=20).mean()
            )
            stock_data["volume_ratio"] = (
                stock_data["Volume"] / stock_data["volume_moving_average_20"]
            )

            return stock_data

        except Exception as e:
            logger.error(f"Error calculating technical indicators: {e}")
            return stock_data


class SentimentAnalysisService:
    """Service for performing sentiment analysis on stock-related news"""

    def __init__(self, hugging_face_api_key: str):
        self.hugging_face_api_key = hugging_face_api_key
        self.finbert_sentiment_url = (
            "https://api-inference.huggingface.co/models/ProsusAI/finbert"
        )

    def analyze_stock_sentiment(
        self, ticker_symbol: str, company_name: str
    ) -> Dict[str, Any]:
        """Analyze sentiment for a specific stock using financial news context"""
        try:
            sentiment_text = f"The stock {ticker_symbol} ({company_name}) market outlook and investor sentiment analysis"

            headers = {}
            if self.hugging_face_api_key:
                headers["Authorization"] = f"Bearer {self.hugging_face_api_key}"

            response = requests.post(
                self.finbert_sentiment_url,
                headers=headers,
                json={"inputs": sentiment_text},
                timeout=10,
            )

            if response.status_code == 200:
                sentiment_data = response.json()
                return (
                    sentiment_data[0]
                    if sentiment_data
                    else {"label": "NEUTRAL", "score": 0.5}
                )
            else:
                logger.warning(
                    f"Sentiment analysis API returned status code: {response.status_code}"
                )
                return {"label": "NEUTRAL", "score": 0.5}

        except Exception as e:
            logger.error(f"Error in sentiment analysis for {ticker_symbol}: {e}")
            return {"label": "NEUTRAL", "score": 0.5}


class MachineLearningModelTrainer:
    """Handles training and management of ML models for stock prediction"""

    def __init__(self):
        self.supported_features = [
            "Open",
            "High",
            "Low",
            "Volume",
            "simple_moving_average_5",
            "simple_moving_average_20",
            "simple_moving_average_50",
            "relative_strength_index",
            "macd_line",
            "macd_signal_line",
            "bollinger_band_upper",
            "bollinger_band_lower",
            "bollinger_position",
            "volume_ratio",
        ]

    def prepare_training_features(self, stock_data: pd.DataFrame) -> tuple:
        """Prepare features for model training"""
        # Remove NaN values
        clean_stock_data = stock_data.dropna()

        if len(clean_stock_data) < 50:
            raise ValueError("Insufficient clean data for model training")

        # Select available features
        available_features = [
            feature
            for feature in self.supported_features
            if feature in clean_stock_data.columns
        ]

        feature_matrix = clean_stock_data[available_features].values
        target_prices = clean_stock_data["Close"].values

        return feature_matrix, target_prices, available_features

    def train_random_forest_model(self, ticker_symbol: str) -> Optional[Dict[str, Any]]:
        """Train an advanced Random Forest model for stock price prediction"""
        try:
            # Fetch training data
            end_date = datetime.now()
            start_date = end_date - timedelta(
                days=app_config.model_training_lookback_days
            )

            stock_data = StockDataProcessor.fetch_historical_stock_data(
                ticker_symbol,
                start_date.strftime("%Y-%m-%d"),
                end_date.strftime("%Y-%m-%d"),
            )

            if stock_data is None:
                return None

            # Calculate technical indicators
            stock_data = StockDataProcessor.calculate_technical_indicators(stock_data)

            # Prepare features
            feature_matrix, target_prices, available_features = (
                self.prepare_training_features(stock_data)
            )

            # Split data for training and testing
            train_features, test_features, train_targets, test_targets = (
                train_test_split(
                    feature_matrix, target_prices, test_size=0.2, random_state=42
                )
            )

            # Train Random Forest model
            random_forest_model = RandomForestRegressor(
                n_estimators=150,
                max_depth=15,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1,
            )

            random_forest_model.fit(train_features, train_targets)

            # Evaluate model performance
            train_predictions = random_forest_model.predict(train_features)
            test_predictions = random_forest_model.predict(test_features)

            train_r2_score = r2_score(train_targets, train_predictions)
            test_r2_score = r2_score(test_targets, test_predictions)
            test_rmse = np.sqrt(mean_squared_error(test_targets, test_predictions))

            model_information = {
                "trained_model": random_forest_model,
                "feature_names": available_features,
                "training_r2_score": train_r2_score,
                "testing_r2_score": test_r2_score,
                "root_mean_squared_error": test_rmse,
                "last_training_timestamp": datetime.now().isoformat(),
                "training_data_points": len(stock_data),
            }

            # Cache the trained model
            model_performance_cache[ticker_symbol] = model_information

            logger.info(
                f"Model trained for {ticker_symbol} - R2 Score: {test_r2_score:.4f}, RMSE: {test_rmse:.4f}"
            )
            return model_information

        except Exception as e:
            logger.error(f"Error training model for {ticker_symbol}: {e}")
            return None


# Initialize services
sentiment_analyzer = SentimentAnalysisService(app_config.hugging_face_api_key)
model_trainer = MachineLearningModelTrainer()


@finance_intelligence_app.route("/health", methods=["GET"])
def health_check_endpoint():
    """Comprehensive health check endpoint"""
    return (
        jsonify(
            {
                "service_status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "cached_models_count": len(model_performance_cache),
                "pdm_engine_status": "active",
                "supported_features": [
                    "stock_prediction",
                    "pdm_strategy_signals",
                    "batch_prediction",
                    "sentiment_analysis",
                    "technical_indicators",
                ],
                "version": "2.0.0",
            }
        ),
        200,
    )


@finance_intelligence_app.route("/predict", methods=["POST"])
def generate_stock_prediction():
    """Enhanced stock price prediction with PDM strategy integration"""
    try:
        request_data = request.get_json()
        ticker_symbol = request_data.get("ticker")
        prediction_days = request_data.get("days", app_config.default_prediction_days)
        include_pdm_analysis = request_data.get("include_pdm", True)

        if not ticker_symbol:
            return (
                jsonify(
                    {
                        "error": "Ticker symbol is required",
                        "example_request": {
                            "ticker": "AAPL",
                            "days": 1,
                            "include_pdm": True,
                        },
                    }
                ),
                400,
            )

        ticker_symbol = ticker_symbol.upper()

        # Check prediction cache
        cache_key = f"{ticker_symbol}_{prediction_days}_{include_pdm_analysis}"
        if cache_key in prediction_results_cache:
            cached_prediction = prediction_results_cache[cache_key]
            cache_timestamp = datetime.fromisoformat(cached_prediction["timestamp"])
            if (
                datetime.now() - cache_timestamp
            ).seconds < app_config.prediction_cache_timeout_seconds:
                logger.info(f"Returning cached prediction for {ticker_symbol}")
                return jsonify(cached_prediction), 200

        # Get or train ML model
        if ticker_symbol in model_performance_cache:
            model_info = model_performance_cache[ticker_symbol]
            logger.info(f"Using cached model for {ticker_symbol}")
        else:
            model_info = model_trainer.train_random_forest_model(ticker_symbol)
            if model_info is None:
                return (
                    jsonify(
                        {
                            "error": f"Could not create prediction model for {ticker_symbol}",
                            "details": "Insufficient data or training failed",
                        }
                    ),
                    500,
                )

        # Fetch recent data for prediction
        recent_stock_data = yf.download(ticker_symbol, period="60d")
        if recent_stock_data.empty:
            return (
                jsonify(
                    {"error": f"Could not fetch recent market data for {ticker_symbol}"}
                ),
                404,
            )

        # Calculate technical indicators for recent data
        recent_stock_data = StockDataProcessor.calculate_technical_indicators(
            recent_stock_data
        )
        clean_recent_data = recent_stock_data.dropna()

        if len(clean_recent_data) == 0:
            return (
                jsonify(
                    {
                        "error": f"Insufficient recent data for analysis of {ticker_symbol}"
                    }
                ),
                404,
            )

        # Prepare features for prediction
        latest_features = (
            clean_recent_data[model_info["feature_names"]]
            .iloc[-1]
            .values.reshape(1, -1)
        )

        # Generate ML prediction
        ml_predicted_price = model_info["trained_model"].predict(latest_features)[0]

        # Get current market data
        current_price = float(clean_recent_data["Close"].iloc[-1])
        price_change = ml_predicted_price - current_price
        percentage_change = (price_change / current_price) * 100

        # Get company information for sentiment analysis
        try:
            company_ticker = yf.Ticker(ticker_symbol)
            company_name = company_ticker.info.get("longName", ticker_symbol)
        except Exception:
            company_name = ticker_symbol

        # Perform sentiment analysis
        market_sentiment = sentiment_analyzer.analyze_stock_sentiment(
            ticker_symbol, company_name
        )

        # Prepare base response
        prediction_response = {
            "ticker_symbol": ticker_symbol,
            "company_name": company_name,
            "current_market_price": round(current_price, 2),
            "ml_predicted_price": round(float(ml_predicted_price), 2),
            "predicted_price_change": round(float(price_change), 2),
            "predicted_percentage_change": round(float(percentage_change), 2),
            "prediction_horizon_days": prediction_days,
            "model_accuracy_r2_score": round(model_info["testing_r2_score"], 4),
            "market_sentiment": market_sentiment,
            "timestamp": datetime.now().isoformat(),
            "technical_indicators": {
                "relative_strength_index": (
                    round(
                        float(clean_recent_data["relative_strength_index"].iloc[-1]), 2
                    )
                    if "relative_strength_index" in clean_recent_data.columns
                    else None
                ),
                "simple_moving_average_5": (
                    round(
                        float(clean_recent_data["simple_moving_average_5"].iloc[-1]), 2
                    )
                    if "simple_moving_average_5" in clean_recent_data.columns
                    else None
                ),
                "simple_moving_average_20": (
                    round(
                        float(clean_recent_data["simple_moving_average_20"].iloc[-1]), 2
                    )
                    if "simple_moving_average_20" in clean_recent_data.columns
                    else None
                ),
                "macd_line": (
                    round(float(clean_recent_data["macd_line"].iloc[-1]), 2)
                    if "macd_line" in clean_recent_data.columns
                    else None
                ),
                "bollinger_position": (
                    round(float(clean_recent_data["bollinger_position"].iloc[-1]), 2)
                    if "bollinger_position" in clean_recent_data.columns
                    else None
                ),
            },
        }

        # Add PDM strategy analysis if requested
        if include_pdm_analysis:
        try:
            pdm_signal = pdm_strategy_engine.generate_pdm_signals(ticker_symbol)
            if pdm_signal:
                prediction_response["pdm_strategy_analysis"] = {
                    "signal_type": pdm_signal.signal_type,
                    "confidence_score": round(pdm_signal.confidence_score, 3),
                    "price_velocity": round(pdm_signal.price_velocity, 4),
                    "price_curvature": round(pdm_signal.price_curvature, 4),
                    "volume_sensitivity": round(pdm_signal.volume_sensitivity, 4),
                    "institutional_volume_factor": round(
                        pdm_signal.institutional_volume_factor, 3
                    ),
                    "atr_hard_stop_loss": round(pdm_signal.atr_stop_loss, 2),
                    "atr_trailing_stop": round(pdm_signal.trailing_stop, 2),
                    "strategy_description": (
                        "Price-Volume Derivatives Momentum Strategy using calculus-based indicators"
                    ),
                }
            else:
                prediction_response["pdm_strategy_analysis"] = {
                    "signal_type": "INSUFFICIENT_DATA",
                    "message": "Unable to generate PDM signal due to insufficient data",
                }
        except Exception as pdm_error:
            logger.error(f"PDM analysis error for {ticker_symbol}: {pdm_error}")
            prediction_response["pdm_strategy_analysis"] = {
                "signal_type": "ERROR",
                "message": "PDM analysis temporarily unavailable",
            }

        # Cache the response
        prediction_results_cache[cache_key] = prediction_response

        logger.info(
            f"Prediction completed for {ticker_symbol}: ML={ml_predicted_price:.2f}"
        )
        return jsonify(prediction_response), 200

    except Exception as e:
        logger.error(f"Error in stock prediction: {e}")
        return (
            jsonify(
                {
                    "error": "An internal server error occurred during prediction",
                    "timestamp": datetime.now().isoformat(),
                }
            ),
            500,
        )


@finance_intelligence_app.route("/pdm_scan", methods=["GET"])
def scan_pdm_opportunities():
    """Scan market for PDM strategy opportunities"""
    try:
        logger.info("Starting PDM market opportunity scan")

        # Scan universe for PDM opportunities
        pdm_opportunities = pdm_strategy_engine.scan_universe_for_opportunities()

        # Format response
        formatted_opportunities = []
        for signal in pdm_opportunities:
            formatted_opportunities.append(
                {
                    "ticker_symbol": signal.symbol,
                    "signal_type": signal.signal_type,
                    "current_price": round(signal.price, 2),
                    "confidence_score": round(signal.confidence_score, 3),
                    "price_velocity": round(signal.price_velocity, 4),
                    "price_curvature": round(signal.price_curvature, 4),
                    "volume_sensitivity": round(signal.volume_sensitivity, 4),
                    "institutional_factor": round(
                        signal.institutional_volume_factor, 3
                    ),
                    "atr_stop_loss": round(signal.atr_stop_loss, 2),
                    "trailing_stop": round(signal.trailing_stop, 2),
                    "signal_timestamp": signal.timestamp.isoformat(),
                }
            )

        return (
            jsonify(
                {
                    "scan_timestamp": datetime.now().isoformat(),
                    "opportunities_found": len(formatted_opportunities),
                    "pdm_signals": formatted_opportunities,
                    "strategy_info": {
                        "name": "Price-Volume Derivatives Momentum Strategy",
                        "methodology": "Calculus-based momentum detection with institutional volume analysis",
                        "max_positions": pdm_strategy_engine.maximum_positions,
                        "min_liquidity_threshold": pdm_strategy_engine.minimum_daily_liquidity,
                    },
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error in PDM opportunity scan: {e}")
        return (
            jsonify(
                {
                    "error": "Failed to scan for PDM opportunities",
                    "timestamp": datetime.now().isoformat(),
                }
            ),
            500,
        )


@finance_intelligence_app.route("/batch_predict", methods=["POST"])
def generate_batch_predictions():
    """Generate predictions for multiple stocks simultaneously"""
    try:
        request_data = request.get_json()
        ticker_list = request_data.get("tickers", [])
        include_pdm_analysis = request_data.get("include_pdm", False)

        if not ticker_list or len(ticker_list) == 0:
            return (
                jsonify(
                    {
                        "error": "Ticker list is required",
                        "example_request": {
                            "tickers": ["AAPL", "GOOGL", "MSFT"],
                            "include_pdm": False,
                        },
                    }
                ),
                400,
            )

        if len(ticker_list) > app_config.max_batch_prediction_size:
            return (
                jsonify(
                    {
                        "error": f"Maximum {app_config.max_batch_prediction_size} tickers allowed per batch"
                    }
                ),
                400,
            )

        logger.info(f"Processing batch prediction for {len(ticker_list)} tickers")

        batch_predictions = []

        for ticker in ticker_list:
            try:
                # Simulate individual prediction call
                individual_request_data = {
                    "ticker": ticker,
                    "include_pdm": include_pdm_analysis,
                }

                # Mock the request object
                class MockRequest:
                    def get_json(self):
                        return individual_request_data

                original_request = request
                request.__dict__.update(MockRequest().__dict__)

                # Get individual prediction
                prediction_result = generate_stock_prediction()

                if prediction_result[1] == 200:  # Success status code
                    batch_predictions.append(prediction_result[0].json)
                else:
                    batch_predictions.append(
                        {
                            "ticker_symbol": ticker,
                            "error": "Individual prediction failed",
                            "timestamp": datetime.now().isoformat(),
                        }
                    )

                # Restore original request
                globals()["request"] = original_request

            except Exception as individual_error:
                logger.error(f"Error predicting {ticker}: {individual_error}")
                batch_predictions.append(
                    {
                        "ticker_symbol": ticker,
                        "error": str(individual_error),
                        "timestamp": datetime.now().isoformat(),
                    }
                )

        return (
            jsonify(
                {
                    "batch_timestamp": datetime.now().isoformat(),
                    "total_predictions": len(batch_predictions),
                    "predictions": batch_predictions,
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error in batch prediction: {e}")
        return (
            jsonify(
                {
                    "error": "Batch prediction processing failed",
                    "timestamp": datetime.now().isoformat(),
                }
            ),
            500,
        )


@finance_intelligence_app.route("/pdm_backtest", methods=["POST"])
def execute_pdm_backtest():
    """Execute PDM strategy backtest"""
    try:
        request_data = request.get_json() or {}
        start_date = request_data.get("start_date", "2025-04-01")
        end_date = request_data.get("end_date", "2025-10-01")

        logger.info(f"Executing PDM backtest from {start_date} to {end_date}")

        backtest_results = pdm_strategy_engine.backtest_pdm_strategy(
            start_date, end_date
        )

        return (
            jsonify(
                {
                    "backtest_results": backtest_results,
                    "execution_timestamp": datetime.now().isoformat(),
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error in PDM backtest: {e}")
        return (
            jsonify(
                {
                    "error": "PDM backtest execution failed",
                    "timestamp": datetime.now().isoformat(),
                }
            ),
            500,
        )


# Error handling middleware
@finance_intelligence_app.errorhandler(404)
def handle_not_found(error):
    return (
        jsonify(
            {
                "error": "API endpoint not found",
                "available_endpoints": {
                    "health_check": "GET /health",
                    "stock_prediction": "POST /predict",
                    "batch_prediction": "POST /batch_predict",
                    "pdm_opportunities": "GET /pdm_scan",
                    "pdm_backtest": "POST /pdm_backtest",
                },
            }
        ),
        404,
    )


@finance_intelligence_app.errorhandler(500)
def handle_internal_error(error):
    logger.error(f"Internal server error: {error}")
    return (
        jsonify(
            {
                "error": "Internal server error occurred",
                "timestamp": datetime.now().isoformat(),
            }
        ),
        500,
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("FLASK_DEBUG", "False").lower() == "true"

    logger.info("Starting Roneira AI HIFI ML Service with PDM Strategy")
    logger.info(f"Port: {port}, Debug: {debug_mode}")

    finance_intelligence_app.run(host="0.0.0.0", port=port, debug=debug_mode)
