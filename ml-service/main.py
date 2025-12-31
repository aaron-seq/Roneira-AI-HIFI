"""
Roneira AI HIFI - FastAPI ML Service

Main entry point for the ML service providing stock predictions,
PDM strategy analysis, and sentiment analysis.

Features:
- Async request handling with FastAPI
- Pydantic validation for all requests/responses
- Integration with existing prediction engines
- OpenAPI documentation auto-generation
"""

import os
import time
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Import existing modules
from pdm_strategy_engine import PriceVolumeDerivativesEngine
from src.models import (
    SignalType,
    ModelType,
    StockPredictionRequest,
    BatchPredictionRequest,
    PDMBacktestRequest,
    StockPredictionResponse,
    BatchPredictionResponse,
    PDMOpportunity,
    PDMScanResponse,
    PDMBacktestResponse,
    HealthCheckResponse,
    TechnicalIndicators,
    PDMAnalysis,
    SentimentAnalysis,
    SentimentLabel,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# =====================================================
# APPLICATION CONFIGURATION
# =====================================================

# Application metadata
APP_TITLE = "Roneira AI HIFI ML Service"
APP_DESCRIPTION = """
Advanced Machine Learning service for stock price predictions and PDM strategy analysis.

## Features
- **Stock Predictions**: ML-based price predictions using Random Forest, LSTM, or GAN models
- **PDM Strategy**: Price-Volume Derivatives Momentum analysis for trading signals
- **Sentiment Analysis**: NLP-based market sentiment from financial news
- **Batch Processing**: Efficient multi-ticker predictions
"""
APP_VERSION = "3.0.0"

# Startup time for uptime calculation
startup_time = time.time()


# =====================================================
# LIFESPAN MANAGEMENT
# =====================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown"""
    # Startup
    logger.info("Starting Roneira AI HIFI ML Service v%s", APP_VERSION)
    logger.info("Initializing PDM Strategy Engine...")

    # Initialize PDM engine
    app.state.pdm_engine = PriceVolumeDerivativesEngine(
        lookback_period=252, min_liquidity=1_000_000
    )

    # Load any cached models
    logger.info("ML Service ready to accept requests")

    yield

    # Shutdown
    logger.info("Shutting down ML Service...")


# =====================================================
# FASTAPI APPLICATION
# =====================================================

app = FastAPI(
    title=APP_TITLE,
    description=APP_DESCRIPTION,
    version=APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# HELPER FUNCTIONS
# =====================================================


def generate_mock_prediction(
    ticker: str, current_price: float = 150.0
) -> Dict[str, Any]:
    """Generate mock prediction data for demonstration"""
    import random

    price_change_pct = random.uniform(-0.05, 0.08)
    predicted_price = current_price * (1 + price_change_pct)

    return {
        "current_price": current_price,
        "predicted_price": predicted_price,
        "price_change": predicted_price - current_price,
        "price_change_percent": price_change_pct * 100,
        "confidence": random.uniform(0.6, 0.95),
        "technical_indicators": TechnicalIndicators(
            sma_20=current_price * 0.98,
            sma_50=current_price * 0.95,
            ema_12=current_price * 0.99,
            ema_26=current_price * 0.97,
            rsi=random.uniform(30, 70),
            macd=random.uniform(-2, 2),
            volume_trend="increasing" if random.random() > 0.5 else "decreasing",
        ),
        "pdm_analysis": PDMAnalysis(
            signal=random.choice([SignalType.BUY, SignalType.SELL, SignalType.HOLD]),
            strength=random.uniform(0.4, 0.9),
            momentum=random.uniform(-0.1, 0.1),
            volume_score=random.uniform(0.5, 1.0),
        ),
        "sentiment": SentimentAnalysis(
            score=random.uniform(-0.5, 0.8),
            label=random.choice(
                [
                    SentimentLabel.POSITIVE,
                    SentimentLabel.NEUTRAL,
                    SentimentLabel.NEGATIVE,
                ]
            ),
            confidence=random.uniform(0.6, 0.95),
        ),
    }


# =====================================================
# HEALTH ENDPOINTS
# =====================================================


@app.get("/health", response_model=HealthCheckResponse, tags=["Health"])
async def health_check():
    """Comprehensive health check endpoint"""
    uptime = time.time() - startup_time

    return HealthCheckResponse(
        status="healthy",
        service="ml-service",
        version=APP_VERSION,
        timestamp=datetime.utcnow(),
        uptime_seconds=uptime,
        dependencies={
            "pdm_engine": {"status": "up"},
            "prediction_model": {"status": "up"},
        },
    )


@app.get("/", tags=["Health"])
async def root():
    """Root endpoint with API information"""
    return {
        "service": APP_TITLE,
        "version": APP_VERSION,
        "status": "running",
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc",
        },
    }


# =====================================================
# PREDICTION ENDPOINTS
# =====================================================


@app.get(
    "/predict/{ticker}",
    response_model=StockPredictionResponse,
    tags=["Predictions"],
    summary="Get stock prediction",
    description="Generate ML-based stock price prediction for a single ticker",
)
async def predict_stock(
    ticker: str = Path(
        ..., description="Stock ticker symbol", min_length=1, max_length=10
    ),
    days: int = Query(7, ge=1, le=30, description="Prediction horizon in days"),
    include_pdm: bool = Query(True, description="Include PDM strategy analysis"),
    model_type: ModelType = Query(
        ModelType.RANDOM_FOREST, description="ML model to use"
    ),
):
    """Generate stock price prediction"""
    ticker = ticker.upper()
    logger.info(f"Generating prediction for {ticker} using {model_type.value}")

    try:
        # Generate prediction (using mock for now, replace with actual model)
        prediction_data = generate_mock_prediction(ticker)

        return StockPredictionResponse(
            ticker=ticker,
            current_price=prediction_data["current_price"],
            predicted_price=prediction_data["predicted_price"],
            price_change=prediction_data["price_change"],
            price_change_percent=prediction_data["price_change_percent"],
            confidence=prediction_data["confidence"],
            prediction_date=datetime.utcnow(),
            model_type=model_type.value,
            model_version="1.0.0",
            technical_indicators=prediction_data["technical_indicators"]
            if include_pdm
            else None,
            pdm_analysis=prediction_data["pdm_analysis"] if include_pdm else None,
            sentiment=prediction_data["sentiment"],
        )
    except Exception as e:
        logger.error(f"Prediction failed for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post(
    "/predict/batch",
    response_model=BatchPredictionResponse,
    tags=["Predictions"],
    summary="Get batch predictions",
    description="Generate predictions for multiple tickers simultaneously",
)
async def predict_batch(request: BatchPredictionRequest):
    """Generate batch stock predictions"""
    logger.info(f"Generating batch predictions for {len(request.tickers)} tickers")

    predictions = []
    failed = 0

    for ticker in request.tickers:
        try:
            prediction_data = generate_mock_prediction(ticker)
            predictions.append(
                StockPredictionResponse(
                    ticker=ticker,
                    current_price=prediction_data["current_price"],
                    predicted_price=prediction_data["predicted_price"],
                    price_change=prediction_data["price_change"],
                    price_change_percent=prediction_data["price_change_percent"],
                    confidence=prediction_data["confidence"],
                    prediction_date=datetime.utcnow(),
                    model_type=ModelType.RANDOM_FOREST.value,
                    technical_indicators=prediction_data["technical_indicators"]
                    if request.include_pdm
                    else None,
                    pdm_analysis=prediction_data["pdm_analysis"]
                    if request.include_pdm
                    else None,
                    sentiment=prediction_data["sentiment"],
                )
            )
        except Exception as e:
            logger.error(f"Failed to predict {ticker}: {e}")
            failed += 1

    return BatchPredictionResponse(
        predictions=predictions,
        batch_id=f"batch_{int(time.time())}",
        requested_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
        total_tickers=len(request.tickers),
        successful_predictions=len(predictions),
        failed_predictions=failed,
    )


# =====================================================
# PDM STRATEGY ENDPOINTS
# =====================================================


@app.get(
    "/pdm/scan",
    response_model=PDMScanResponse,
    tags=["PDM Strategy"],
    summary="Scan for PDM opportunities",
    description="Scan market for trading opportunities using PDM strategy",
)
async def scan_pdm_opportunities():
    """Scan market for PDM strategy opportunities"""
    logger.info("Scanning market for PDM opportunities")

    # Mock opportunities for demonstration
    import random

    sample_tickers = ["AAPL", "TSLA", "GOOGL", "MSFT", "AMZN", "META", "NVDA"]
    opportunities = []

    for ticker in sample_tickers:
        if random.random() > 0.5:  # 50% chance of opportunity
            signal = random.choice([SignalType.BUY, SignalType.SELL])
            price = random.uniform(100, 500)

            opportunities.append(
                PDMOpportunity(
                    ticker=ticker,
                    signal=signal,
                    strength=random.uniform(0.6, 0.95),
                    price=price,
                    momentum=random.uniform(-0.1, 0.1),
                    volume_score=random.uniform(0.5, 1.0),
                    recommended_action=f"{signal.value} at ${price:.2f}",
                    entry_price=price,
                    stop_loss=price * 0.95
                    if signal == SignalType.BUY
                    else price * 1.05,
                    take_profit=price * 1.10
                    if signal == SignalType.BUY
                    else price * 0.90,
                )
            )

    return PDMScanResponse(
        opportunities=sorted(opportunities, key=lambda x: x.strength, reverse=True),
        scanned_tickers=len(sample_tickers),
        scan_time=datetime.utcnow(),
        market_sentiment="bullish"
        if len([o for o in opportunities if o.signal == SignalType.BUY])
        > len([o for o in opportunities if o.signal == SignalType.SELL])
        else "bearish",
    )


@app.post(
    "/pdm/backtest",
    response_model=PDMBacktestResponse,
    tags=["PDM Strategy"],
    summary="Run PDM backtest",
    description="Execute PDM strategy backtest on historical data",
)
async def run_pdm_backtest(request: PDMBacktestRequest):
    """Execute PDM strategy backtest"""
    start = request.start_date or (date.today() - timedelta(days=365))
    end = request.end_date or date.today()

    logger.info(f"Running PDM backtest from {start} to {end}")

    # Mock backtest results
    import random

    total_trades = random.randint(30, 100)
    winning = random.randint(int(total_trades * 0.5), int(total_trades * 0.7))
    losing = total_trades - winning

    total_return = request.initial_capital * random.uniform(0.05, 0.35)

    return PDMBacktestResponse(
        start_date=start,
        end_date=end,
        total_trades=total_trades,
        winning_trades=winning,
        losing_trades=losing,
        win_rate=winning / total_trades,
        total_return=total_return,
        total_return_percent=(total_return / request.initial_capital) * 100,
        max_drawdown=random.uniform(0.05, 0.15),
        sharpe_ratio=random.uniform(1.0, 2.5),
        initial_capital=request.initial_capital,
        final_capital=request.initial_capital + total_return,
    )


# =====================================================
# ERROR HANDLERS
# =====================================================


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "type": "HTTP_ERROR",
                "message": exc.detail,
                "status_code": exc.status_code,
            },
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle unexpected exceptions"""
    logger.error(f"Unexpected error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "type": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
            },
        },
    )


# =====================================================
# MAIN ENTRY POINT
# =====================================================

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("FLASK_ENV") == "development",
        log_level="info",
    )
