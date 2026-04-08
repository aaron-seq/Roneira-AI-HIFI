"""
Roneira AI HIFI — ML Backend
FastAPI service for stock prediction, market data, and ML model serving.
"""
import time
import logging
from datetime import datetime

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.models.random_forest import RandomForestPredictor
from app.models.technical_analysis import TechnicalAnalyzer
from app.models.pdm_momentum import PVDMomentumEngine
from app.models.ensemble import EnsembleCombiner
from app.models.lstm import LSTMPredictor
from app.models.gan import GANPredictor

# ========== Configuration ==========
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("roneira-ml")

app = FastAPI(
    title="Roneira AI HIFI — ML Backend",
    description="AI-powered stock prediction API with LSTM, Random Forest, GAN, and Ensemble models",
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://roneira.ai"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== Initialize Models ==========
rf_predictor = RandomForestPredictor()
ta_analyzer = TechnicalAnalyzer()
pdm_engine = PVDMomentumEngine()
ensemble = EnsembleCombiner()
lstm_predictor = LSTMPredictor()
gan_predictor = GANPredictor()

# ========== Pydantic Models ==========
class PredictionRequest(BaseModel):
    ticker: str
    timeframe: str = Field(default="1month", description="tomorrow, 1week, 1month, 3month, 6month, 1year, 1year_plus")
    model_type: str = Field(default="ENSEMBLE", description="LSTM, RANDOM_FOREST, GAN, ENSEMBLE, FUNDAMENTAL, TECHNICAL, PVD_MOMENTUM")
    include_pdm: bool = True


class PredictionResponse(BaseModel):
    ticker: str
    company_name: str
    exchange: str
    sector: str | None = None
    pe_ratio: float | None = None
    market_cap: float | None = None
    current_price: float
    predicted_price: float
    price_change: float
    price_change_percent: float
    confidence: float
    confidence_breakdown: dict
    short_term_signal: dict
    long_term_signal: dict
    indicators: list
    price_target_low: float
    price_target_high: float
    model_used: str
    timeframe: str
    computation_time_ms: float


class MarketDataRequest(BaseModel):
    symbols: str


class TTLCache:
    def __init__(self, ttl_seconds: int):
        self.ttl_seconds = ttl_seconds
        self._store: dict[str, tuple[float, object]] = {}

    def get(self, key: str):
        cached = self._store.get(key)
        if not cached:
            return None

        expires_at, value = cached
        if expires_at <= time.time():
            self._store.pop(key, None)
            return None

        return value

    def set(self, key: str, value: object):
        self._store[key] = (time.time() + self.ttl_seconds, value)


historical_cache = TTLCache(ttl_seconds=15 * 60)
company_cache = TTLCache(ttl_seconds=60 * 60)


# ========== Data Fetching ==========
def fetch_stock_data(ticker: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    """Fetch historical stock data from yfinance."""
    cache_key = f"{ticker}:{period}:{interval}"
    cached = historical_cache.get(cache_key)
    if isinstance(cached, pd.DataFrame):
        return cached.copy()

    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period=period, interval=interval)
        if df.empty:
            raise ValueError(f"No data found for {ticker}")
        historical_cache.set(cache_key, df)
        return df
    except Exception as e:
        logger.error(f"Failed to fetch data for {ticker}: {e}")
        raise HTTPException(status_code=404, detail=f"Stock data not found: {ticker}")


def get_company_info(ticker: str) -> dict:
    """Get company name and exchange from yfinance."""
    cached = company_cache.get(ticker)
    if isinstance(cached, dict):
        return cached

    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        company = {
            "name": info.get("longName", info.get("shortName", ticker)),
            "exchange": info.get("exchange", "Unknown"),
            "sector": info.get("sector", "Unknown"),
            "pe_ratio": info.get("trailingPE", None),
            "market_cap": info.get("marketCap", None),
        }
        company_cache.set(ticker, company)
        return company
    except Exception:
        return {"name": ticker, "exchange": "Unknown", "sector": "Unknown"}


def get_exchange_from_ticker(ticker: str) -> str:
    """Determine exchange from ticker suffix."""
    if ticker.endswith(".NS"):
        return "NSE"
    elif ticker.endswith(".BO"):
        return "BSE"
    elif ticker.startswith("^"):
        return "INDEX"
    else:
        return "NASDAQ"


TIMEFRAME_DAYS = {
    "tomorrow": 1,
    "1week": 7,
    "1month": 30,
    "3month": 90,
    "6month": 180,
    "1year": 365,
    "1year_plus": 400,
}


# ========== API Routes ==========
@app.get("/")
async def root():
    return {
        "service": "Roneira AI HIFI — ML Backend",
        "version": "4.0.0",
        "status": "operational",
        "models": ["RANDOM_FOREST", "LSTM", "GAN", "TECHNICAL", "PVD_MOMENTUM", "ENSEMBLE"],
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "uptime": time.time(),
        "models_loaded": {
            "random_forest": rf_predictor.is_ready(),
            "lstm": lstm_predictor.is_ready(),
            "gan": gan_predictor.is_ready(),
            "technical": True,
            "pdm_momentum": True,
            "ensemble": True,
        },
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Run ML prediction on a stock ticker."""
    start_time = time.time()
    ticker = request.ticker.upper()
    timeframe = request.timeframe
    model_type = request.model_type.upper()

    logger.info(f"Prediction request: {ticker} | {timeframe} | {model_type}")

    # Fetch data
    period = "2y" if timeframe in ("1year", "1year_plus") else "1y"
    df = fetch_stock_data(ticker, period)
    company = get_company_info(ticker)
    current_price = float(df["Close"].iloc[-1])
    exchange = get_exchange_from_ticker(ticker)

    # Run selected model
    horizon = TIMEFRAME_DAYS.get(timeframe, 30)
    if model_type == "RANDOM_FOREST":
        prediction = rf_predictor.predict(df, horizon)
    elif model_type == "LSTM":
        prediction = lstm_predictor.predict(df, horizon)
    elif model_type == "GAN":
        prediction = gan_predictor.predict(df, horizon)
    elif model_type == "TECHNICAL":
        prediction = ta_analyzer.analyze(df, horizon)
    elif model_type == "PVD_MOMENTUM":
        prediction = pdm_engine.analyze(df, ticker, horizon)
    elif model_type == "ENSEMBLE":
        # Run all available models and combine
        rf_result = rf_predictor.predict(df, horizon)
        ta_result = ta_analyzer.analyze(df, horizon)
        pdm_result = pdm_engine.analyze(df, ticker, horizon)
        lstm_result = lstm_predictor.predict(df, horizon)
        prediction = ensemble.combine(
            [rf_result, ta_result, pdm_result, lstm_result],
            weights=[0.3, 0.2, 0.2, 0.3],
        )
    else:
        # Default to Ensemble
        prediction = rf_predictor.predict(df, horizon)

    # Calculate price targets
    predicted_price = prediction["predicted_price"]
    price_change = predicted_price - current_price
    price_change_pct = (price_change / current_price) * 100
    volatility = float(df["Close"].pct_change().std()) * np.sqrt(252)
    target_range = predicted_price * volatility * 0.5

    computation_time = (time.time() - start_time) * 1000

    return PredictionResponse(
        ticker=ticker,
        company_name=company["name"],
        exchange=exchange,
        sector=company.get("sector"),
        pe_ratio=company.get("pe_ratio"),
        market_cap=company.get("market_cap"),
        current_price=current_price,
        predicted_price=round(predicted_price, 2),
        price_change=round(price_change, 2),
        price_change_percent=round(price_change_pct, 2),
        confidence=round(prediction["confidence"], 1),
        confidence_breakdown=prediction.get("confidence_breakdown", {
            "technical": round(prediction["confidence"] * 0.9, 1),
            "fundamental": round(prediction["confidence"] * 0.85, 1),
            "sentiment": round(prediction["confidence"] * 0.7, 1),
            "historical": round(prediction["confidence"] * 0.95, 1),
        }),
        short_term_signal=prediction.get("short_term_signal", {"signal": "HOLD", "score": 5.0}),
        long_term_signal=prediction.get("long_term_signal", {"signal": "BUY", "score": 6.0}),
        indicators=prediction.get("indicators", []),
        price_target_low=round(predicted_price - target_range, 2),
        price_target_high=round(predicted_price + target_range, 2),
        model_used=model_type,
        timeframe=timeframe,
        computation_time_ms=round(computation_time, 1),
    )


@app.get("/market-data")
async def market_data(symbols: str = "^NSEI,^BSESN,^IXIC,^GSPC"):
    """Fetch live market data for multiple symbols."""
    symbol_list = [s.strip() for s in symbols.split(",")]
    results = []

    for symbol in symbol_list[:20]:  # Limit to 20
        try:
            hist = fetch_stock_data(symbol, period="5d")
            if hist.empty:
                continue

            current = float(hist["Close"].iloc[-1])
            prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else current
            change = current - prev
            change_pct = (change / prev) * 100 if prev else 0
            company = get_company_info(symbol)

            results.append({
                "symbol": symbol,
                "name": company.get("name", symbol),
                "price": round(current, 2),
                "change": round(change, 2),
                "change_percent": round(change_pct, 2),
                "volume": int(hist["Volume"].iloc[-1]) if "Volume" in hist.columns else 0,
                "high": round(float(hist["High"].iloc[-1]), 2),
                "low": round(float(hist["Low"].iloc[-1]), 2),
            })
        except Exception as e:
            logger.warning(f"Failed to fetch {symbol}: {e}")
            continue

    return {"data": results, "timestamp": datetime.utcnow().isoformat()}


@app.get("/stock/{ticker}")
async def stock_details(ticker: str):
    """Get detailed information for a single stock."""
    df = fetch_stock_data(ticker)
    company = get_company_info(ticker)
    current_price = float(df["Close"].iloc[-1])

    # Technical indicators
    ta_result = ta_analyzer.analyze(df, 30)

    return {
        "ticker": ticker,
        "company": company,
        "current_price": current_price,
        "exchange": get_exchange_from_ticker(ticker),
        "indicators": ta_result.get("indicators", []),
        "signal": ta_result.get("short_term_signal", {}),
    }


@app.get("/history")
async def history(symbol: str, interval: str = "1day", range: str = "6month"):
    interval_map = {
        "1min": "1m",
        "5min": "5m",
        "15min": "15m",
        "1hour": "60m",
        "1day": "1d",
        "1week": "1wk",
    }
    period_map = {
        "1month": "1mo",
        "3month": "3mo",
        "6month": "6mo",
        "1year": "1y",
        "2year": "2y",
    }

    df = fetch_stock_data(
        symbol,
        period=period_map.get(range, "6mo"),
        interval=interval_map.get(interval, "1d"),
    )

    candles = [
        {
            "time": idx.isoformat(),
            "open": round(float(row["Open"]), 4),
            "high": round(float(row["High"]), 4),
            "low": round(float(row["Low"]), 4),
            "close": round(float(row["Close"]), 4),
            "volume": int(row["Volume"]) if "Volume" in row and not pd.isna(row["Volume"]) else 0,
        }
        for idx, row in df.iterrows()
    ]

    return {
        "symbol": symbol,
        "interval": interval,
        "range": range,
        "candles": candles,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
