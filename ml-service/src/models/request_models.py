"""
Roneira AI HIFI - Pydantic Request/Response Models

Defines strict schemas for all API requests and responses using Pydantic.
Provides automatic validation, documentation, and type safety.
"""

from datetime import date, datetime
from typing import Optional, List, Dict, Any
from enum import Enum

from pydantic import BaseModel, Field, field_validator


# =====================================================
# ENUMS
# =====================================================

class SignalType(str, Enum):
    """PDM signal types"""
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


class ModelType(str, Enum):
    """Supported ML model types"""
    RANDOM_FOREST = "random_forest"
    LSTM = "lstm"
    GAN = "gan"
    ENSEMBLE = "ensemble"


class SentimentLabel(str, Enum):
    """Sentiment analysis labels"""
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"


# =====================================================
# REQUEST MODELS
# =====================================================

class StockPredictionRequest(BaseModel):
    """Request model for stock prediction"""
    ticker: str = Field(
        ...,
        min_length=1,
        max_length=10,
        description="Stock ticker symbol (e.g., AAPL, TSLA)"
    )
    days: int = Field(
        default=7,
        ge=1,
        le=30,
        description="Number of days to predict ahead"
    )
    include_pdm: bool = Field(
        default=True,
        description="Include PDM strategy analysis"
    )
    model_type: Optional[ModelType] = Field(
        default=ModelType.RANDOM_FOREST,
        description="ML model to use for prediction"
    )

    @field_validator('ticker')
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        return v.upper().strip()


class BatchPredictionRequest(BaseModel):
    """Request model for batch predictions"""
    tickers: List[str] = Field(
        ...,
        min_length=1,
        max_length=10,
        description="List of stock ticker symbols"
    )
    include_pdm: bool = Field(
        default=True,
        description="Include PDM strategy analysis for each ticker"
    )

    @field_validator('tickers')
    @classmethod
    def validate_tickers(cls, v: List[str]) -> List[str]:
        return [ticker.upper().strip() for ticker in v]


class PDMBacktestRequest(BaseModel):
    """Request model for PDM strategy backtest"""
    start_date: Optional[date] = Field(
        default=None,
        description="Backtest start date (YYYY-MM-DD)"
    )
    end_date: Optional[date] = Field(
        default=None,
        description="Backtest end date (YYYY-MM-DD)"
    )
    tickers: Optional[List[str]] = Field(
        default=None,
        description="Specific tickers to backtest, or market-wide if None"
    )
    initial_capital: float = Field(
        default=100000.0,
        ge=1000.0,
        description="Initial capital for backtest"
    )


# =====================================================
# RESPONSE MODELS
# =====================================================

class TechnicalIndicators(BaseModel):
    """Technical analysis indicators"""
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    ema_12: Optional[float] = None
    ema_26: Optional[float] = None
    rsi: Optional[float] = Field(default=None, ge=0, le=100)
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    bollinger_upper: Optional[float] = None
    bollinger_lower: Optional[float] = None
    volume_trend: Optional[str] = None


class PDMAnalysis(BaseModel):
    """PDM strategy analysis results"""
    signal: SignalType = Field(description="Trading signal")
    strength: float = Field(ge=0, le=1, description="Signal strength (0-1)")
    momentum: Optional[float] = Field(default=None, description="Price momentum")
    volume_score: Optional[float] = Field(default=None, description="Volume analysis score")
    liquidity: Optional[float] = Field(default=None, description="Market liquidity indicator")
    entry_price: Optional[float] = Field(default=None, description="Recommended entry price")
    stop_loss: Optional[float] = Field(default=None, description="Recommended stop loss")
    take_profit: Optional[float] = Field(default=None, description="Recommended take profit")


class SentimentAnalysis(BaseModel):
    """Sentiment analysis results"""
    score: float = Field(ge=-1, le=1, description="Sentiment score (-1 to 1)")
    label: SentimentLabel = Field(description="Sentiment classification")
    confidence: float = Field(ge=0, le=1, description="Analysis confidence")
    sources_analyzed: Optional[int] = None


class StockPredictionResponse(BaseModel):
    """Response model for stock prediction"""
    ticker: str
    current_price: float
    predicted_price: float
    price_change: float
    price_change_percent: float
    confidence: float = Field(ge=0, le=1)
    prediction_date: datetime = Field(default_factory=datetime.utcnow)
    model_type: str
    model_version: Optional[str] = None
    technical_indicators: Optional[TechnicalIndicators] = None
    pdm_analysis: Optional[PDMAnalysis] = None
    sentiment: Optional[SentimentAnalysis] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class BatchPredictionResponse(BaseModel):
    """Response model for batch predictions"""
    predictions: List[StockPredictionResponse]
    batch_id: Optional[str] = None
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    total_tickers: int
    successful_predictions: int
    failed_predictions: int

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class PDMOpportunity(BaseModel):
    """Single PDM opportunity"""
    ticker: str
    signal: SignalType
    strength: float = Field(ge=0, le=1)
    price: float
    momentum: Optional[float] = None
    volume_score: Optional[float] = None
    recommended_action: Optional[str] = None
    entry_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None


class PDMScanResponse(BaseModel):
    """Response model for PDM opportunity scan"""
    opportunities: List[PDMOpportunity]
    scanned_tickers: int
    scan_time: datetime = Field(default_factory=datetime.utcnow)
    market_sentiment: Optional[str] = None


class TradeResult(BaseModel):
    """Single trade result for backtest"""
    ticker: str
    entry_date: date
    exit_date: date
    entry_price: float
    exit_price: float
    profit_loss: float
    profit_loss_percent: float
    signal: SignalType


class PDMBacktestResponse(BaseModel):
    """Response model for PDM backtest"""
    start_date: date
    end_date: date
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float = Field(ge=0, le=1)
    total_return: float
    total_return_percent: float
    max_drawdown: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    initial_capital: float
    final_capital: float
    trades: Optional[List[TradeResult]] = None


class HealthCheckResponse(BaseModel):
    """Health check response"""
    status: str = Field(description="Service status: healthy, degraded, unhealthy")
    service: str = "ml-service"
    version: str = "3.0.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    uptime_seconds: Optional[float] = None
    dependencies: Optional[Dict[str, Dict[str, Any]]] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# =====================================================
# ERROR MODELS
# =====================================================

class ErrorDetail(BaseModel):
    """Error detail for validation errors"""
    field: str
    message: str
    code: str


class ErrorResponse(BaseModel):
    """Standard error response"""
    success: bool = False
    error: Dict[str, Any] = Field(
        description="Error details including type, message, and optional details"
    )
