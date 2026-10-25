"""
Roneira AI HIFI — ML Backend
FastAPI service for stock prediction, market data, and ML model serving.
"""
import hmac
import json
import os
import time
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Literal

import numpy as np
import pandas as pd
import yfinance as yf
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

from app.models.random_forest import RandomForestPredictor
from app.models.technical_analysis import TechnicalAnalyzer
from app.models.pdm_momentum import PVDMomentumEngine
from app.models.ensemble import ENSEMBLE_MEMBERS, ENSEMBLE_WEIGHTS, EnsembleCombiner
from app.models.lstm import LSTMPredictor
from app.models.gan import GANPredictor
from app.horizons import TIMEFRAME_SESSIONS, history_period, serving_lookback
import export_stock_screener as screener

# ========== Configuration ==========
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("roneira-ml")

# Each worker's elapsed clock starts when it initializes this application module.
_PROCESS_STARTED_AT = time.monotonic()

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

# ========== Service authentication ==========
# CORS above is a *browser* policy: FastAPI still runs the handler and returns
# the body, the browser just withholds it from JS on a disallowed origin. curl
# ignores it entirely. Since this service must be publicly routable for Vercel
# to reach it, CORS alone left /predict open to anyone who found the hostname,
# bypassing the Next.js rate limit and Zod validation (task.md guardrail: "Keep
# FastAPI private behind Next.js API routes").
#
# The caller is a single trusted service, not a user population, so a shared
# secret is the right size of mechanism -- no key rotation or JWT machinery.
ML_SERVICE_TOKEN = os.getenv("ML_SERVICE_TOKEN", "")


def require_service_token(x_ml_service_token: str = Header(default="")) -> None:
    """Reject any caller that cannot present the shared secret.

    Fails closed when ML_SERVICE_TOKEN is unset: an unconfigured deployment is
    the exact case where an open endpoint would go unnoticed, so it must be
    loud rather than permissive.
    """
    if not ML_SERVICE_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="ML_SERVICE_TOKEN is not configured on the ML service",
        )

    # compare_digest, not ==, so a wrong token cannot be recovered byte-by-byte
    # from response-time differences.
    if not hmac.compare_digest(x_ml_service_token, ML_SERVICE_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid service token")


# Applied per-route rather than app-wide so /health stays reachable for the
# platform's health check, which cannot send custom headers.
protected = [Depends(require_service_token)]

# ========== Initialize Models ==========
rf_predictor = RandomForestPredictor()
ta_analyzer = TechnicalAnalyzer()
pdm_engine = PVDMomentumEngine()
ensemble = EnsembleCombiner()
lstm_predictor = LSTMPredictor()
gan_predictor = GANPredictor()

# ========== Pydantic Models ==========
class PredictionRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9.^=:-]+$")
    timeframe: Literal["tomorrow", "1week", "1month", "3month", "6month", "1year", "1year_plus"] = "1month"
    model_type: Literal["LSTM", "RANDOM_FOREST", "GAN", "ENSEMBLE", "TECHNICAL", "PVD_MOMENTUM"] = "ENSEMBLE"
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
    # Ensemble-only. Present so the UI can show how much the constituent models
    # disagreed instead of only the blended point estimate.
    components: list[dict] | None = None
    agreement_score: float | None = None
    price_spread: float | None = None
    horizon_sessions: int
    history_sessions: int
    data_session_date: str
    data_session_timezone: str | None = None
    model_status: dict
    fallback: bool = False
    fallback_reason: str | None = None
    excluded_components: list[dict] = Field(default_factory=list)


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
# Fundamentals (P/E, ROE, dividend yield, ...) don't meaningfully change
# intraday; building the dataset is 42 tickers x 2 live fetches each, so this
# is cached far longer than a price quote would be.
screener_cache = TTLCache(ttl_seconds=30 * 60)


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
        if not df.empty:
            # Yahoo appends a placeholder row (NaN OHLC, stub volume) for the
            # most recent/in-progress session. A NaN Close poisons everything
            # downstream: iloc[-1] price reads, model features, and JSON
            # encoding (NaN is not valid JSON).
            df = df.dropna(subset=["Close"])
            # A numeric but infinite/zero close is just as unusable as NaN.
            valid = np.isfinite(df["Close"]) & (df["Close"] > 0)
            df = df.loc[valid]
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


TIMEFRAME_DAYS = TIMEFRAME_SESSIONS  # compatibility for callers of the old name


# ========== API Routes ==========
@app.get("/")
async def root():
    return {
        "service": "Roneira AI HIFI — ML Backend",
        "version": "4.0.0",
        "status": "operational",
        "models": ["RANDOM_FOREST", "LSTM", "GAN", "TECHNICAL", "PVD_MOMENTUM", "ENSEMBLE"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "uptime": time.monotonic() - _PROCESS_STARTED_AT,
        "models_loaded": {
            "random_forest": rf_predictor.is_ready(),
            "lstm": lstm_predictor.is_ready(),
            "gan": gan_predictor.is_ready(),
            "technical": True,
            "pdm_momentum": True,
            "ensemble": True,
        },
    }


@app.post("/predict", response_model=PredictionResponse, dependencies=protected)
def predict(request: PredictionRequest):
    """Run ML prediction on a stock ticker."""
    start_time = time.time()
    ticker = request.ticker.upper()
    timeframe = request.timeframe
    model_type = request.model_type.upper()

    logger.info(f"Prediction request: {ticker} | {timeframe} | {model_type}")

    # Fetch data
    horizon = TIMEFRAME_SESSIONS[timeframe]
    df = fetch_stock_data(ticker, history_period(horizon)).tail(serving_lookback(horizon))
    if df.empty or not np.isfinite(df["Close"].iloc[-1]) or df["Close"].iloc[-1] <= 0:
        raise HTTPException(status_code=422, detail="No valid price history is available")
    company = get_company_info(ticker)
    current_price = float(df["Close"].iloc[-1])
    exchange = get_exchange_from_ticker(ticker)

    # Run selected model
    def run_model(name: str) -> dict:
        if name == "RANDOM_FOREST":
            result = rf_predictor.predict(df, horizon)
            backend = "random_forest"
        elif name == "TECHNICAL":
            result = ta_analyzer.analyze(df, horizon)
            backend = "technical"
        elif name == "PVD_MOMENTUM":
            result = pdm_engine.analyze(df, ticker, horizon)
            backend = "pvd_momentum"
        elif name == "LSTM":
            return lstm_predictor.predict(df, horizon)
        else:
            return gan_predictor.predict(df, horizon)
        result["backend"] = backend
        result["trained_horizon_sessions"] = horizon if name == "RANDOM_FOREST" and not result.get("fallback") else None
        if result.get("fallback") or result.get("error"):
            # Exceptions are logged by the owning model; expose only a stable
            # operational reason, not internal details or invented signals.
            result.update(
                predicted_price=current_price, confidence=0, indicators=[], fallback=True,
                fallback_reason=result.get("fallback_reason") or "inference_failed",
                short_term_signal={"signal": "HOLD", "score": 5.0},
                long_term_signal={"signal": "HOLD", "score": 5.0},
            )
        return result

    if model_type == "ENSEMBLE":
        # Run all available models and combine
        # Members and weights live in ensemble.py, next to the reasoning and
        # the walk-forward numbers behind them (#145).
        prediction = ensemble.combine(
            [run_model(name) for name in ENSEMBLE_MEMBERS],
            weights=list(ENSEMBLE_WEIGHTS),
            names=list(ENSEMBLE_MEMBERS),
        )
    else:
        prediction = run_model(model_type)

    # Calculate price targets
    predicted_price = prediction["predicted_price"]
    if not isinstance(predicted_price, (int, float)) or not np.isfinite(predicted_price) or predicted_price <= 0:
        raise HTTPException(status_code=422, detail="The model could not produce a valid estimate")
    price_change = predicted_price - current_price
    price_change_pct = (price_change / current_price) * 100
    volatility = float(df["Close"].pct_change().std()) * np.sqrt(252)
    if not np.isfinite(volatility):
        volatility = 0.0
    target_range = predicted_price * volatility * 0.5

    computation_time = (time.time() - start_time) * 1000

    fallback = bool(prediction.get("fallback"))
    session = df.index[-1]
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
        price_target_low=round(current_price if fallback else max(0, predicted_price - target_range), 2),
        price_target_high=round(current_price if fallback else predicted_price + target_range, 2),
        model_used=model_type,
        timeframe=timeframe,
        computation_time_ms=round(computation_time, 1),
        components=prediction.get("components"),
        agreement_score=prediction.get("agreement_score"),
        price_spread=prediction.get("price_spread"),
        horizon_sessions=horizon,
        history_sessions=len(df),
        data_session_date=session.strftime("%Y-%m-%d"),
        data_session_timezone=str(df.index.tz) if df.index.tz is not None else None,
        fallback=fallback,
        fallback_reason=prediction.get("fallback_reason"),
        excluded_components=prediction.get("excluded_components", []),
        model_status={
            "backend": prediction.get("backend") or "unknown",
            "requested_horizon_sessions": horizon,
            "trained_horizon_sessions": prediction.get("trained_horizon_sessions"),
            "fallback": fallback,
            "fallback_reason": prediction.get("fallback_reason"),
        },
    )


@app.get("/market-data", dependencies=protected)
def market_data(symbols: str = "^NSEI,^BSESN,^IXIC,^GSPC"):
    """Fetch live market data for multiple symbols."""
    symbol_list = list(dict.fromkeys(s.strip() for s in symbols.split(",") if s.strip()))
    if len(symbol_list) > 20:
        raise HTTPException(status_code=422, detail="At most 20 unique symbols per request; split into batches")

    def quote(symbol: str) -> dict | None:
        try:
            hist = fetch_stock_data(symbol, period="5d")
            current = float(hist["Close"].iloc[-1])
            prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else None
            comparison_available = prev is not None and np.isfinite(prev) and prev > 0
            change = current - prev if comparison_available else 0
            change_pct = (change / prev) * 100 if comparison_available else 0
            company = get_company_info(symbol)
            bar_date = pd.Timestamp(hist.index[-1])
            session_date = None if pd.isna(bar_date) else bar_date.date().isoformat()
            session_timezone = str(bar_date.tz) if bar_date.tz is not None else None

            return {
                "symbol": symbol,
                "name": company.get("name", symbol),
                "price": round(current, 2),
                "change": round(change, 2),
                "change_percent": round(change_pct, 2),
                "previous_close": prev if comparison_available else None,
                "change_available": comparison_available,
                "change_percent_available": comparison_available,
                "volume": int(hist["Volume"].iloc[-1]) if "Volume" in hist.columns else 0,
                "high": round(float(hist["High"].iloc[-1]), 2),
                "low": round(float(hist["Low"].iloc[-1]), 2),
                # Daily index midnight labels a session; it is not a trade's
                # as-of timestamp. Never substitute request time for either.
                "timestamp": None,
                "session_date": session_date,
                "session_timezone": session_timezone,
            }
        except Exception as e:
            logger.warning(f"Failed to fetch {symbol}: {e}")
            return None

    # Fetching 16+ symbols one at a time took long enough that callers timed out
    # before the payload landed. Fan out instead; fetch_stock_data is cached, so
    # repeat hits stay cheap.
    # ponytail: fixed 8-wide pool, revisit if Yahoo starts rate-limiting the burst
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = [row for row in pool.map(quote, symbol_list) if row is not None]

    return {"data": results, "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/stock/{ticker}", dependencies=protected)
def stock_details(ticker: str):
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


@app.get("/history", dependencies=protected)
def history(symbol: str, interval: str = "1day", range: str = "6month"):
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


def _records(df: pd.DataFrame) -> list[dict]:
    """DataFrame -> JSON-safe records. Plain `.to_dict()` chokes on NaN (not
    valid JSON); `.to_json()` already converts NaN -> null correctly."""
    if df.empty:
        return []
    return json.loads(df.to_json(orient="records"))


@app.get("/screener", dependencies=protected)
def stock_screener():
    """
    Live fundamentals screener -- same logic and same 42-ticker starter
    universe as `export_stock_screener.py` (the XLSX export script), served
    as JSON for the dashboard instead of a downloaded file. See that file's
    module docstring for what the screens do and don't claim.
    """
    cached = screener_cache.get("dataset")
    if cached is not None:
        return cached

    df = screener.build_dataset()
    if df.empty:
        raise HTTPException(status_code=502, detail="No screener data available (yfinance fetch failed for every ticker)")

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "all": _records(df),
        "large_cap_strong": _records(screener.screen_fundamentally_strong(df[df["tier"] == "Large"])),
        "mid_cap_strong": _records(screener.screen_fundamentally_strong(df[df["tier"] == "Mid"])),
        "small_cap_strong": _records(screener.screen_fundamentally_strong(df[df["tier"] == "Small"])),
        "dividend_payers": _records(screener.screen_dividend_payers(df)),
        "undervalued_growth": _records(screener.screen_undervalued_growth(df)),
    }
    screener_cache.set("dataset", payload)
    return payload


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
