# API Endpoints Documentation

Roneira AI HIFI Backend API Reference

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://your-domain.com`

## Authentication

Currently using basic API access. JWT authentication planned for future versions.

## Health Check

### GET /health

Check system health status

**Response:**
```json
{
  "service_status": "healthy",
  "timestamp": "2025-10-18T10:00:00.000Z",
  "environment": "development",
  "version": "2.0.0",
  "ml_service_status": "healthy",
  "uptime_seconds": 3600
}
```

## Stock Prediction

### POST /api/predict

Get AI-powered stock price prediction with optional PDM analysis

**Request Body:**
```json
{
  "ticker": "AAPL",
  "days": 1,
  "include_pdm": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ticker_symbol": "AAPL",
    "company_name": "Apple Inc.",
    "current_market_price": 150.25,
    "ml_predicted_price": 152.80,
    "predicted_price_change": 2.55,
    "predicted_percentage_change": 1.70,
    "prediction_horizon_days": 1,
    "model_accuracy_r2_score": 0.85,
    "market_sentiment": {
      "label": "POSITIVE",
      "score": 0.75
    },
    "technical_indicators": {
      "relative_strength_index": 65.2,
      "simple_moving_average_20": 148.50,
      "macd_line": 1.25,
      "bollinger_position": 0.65
    },
    "pdm_strategy_analysis": {
      "signal_type": "LONG",
      "confidence_score": 0.82,
      "price_velocity": 1.45,
      "price_curvature": -0.25,
      "volume_sensitivity": 0.003,
      "institutional_volume_factor": 1.85,
      "atr_hard_stop_loss": 145.30,
      "atr_trailing_stop": 142.15,
      "strategy_description": "Strong momentum signal with institutional participation"
    },
    "timestamp": "2025-10-18T10:00:00.000Z"
  },
  "timestamp": "2025-10-18T10:00:00.000Z"
}
```

### POST /api/batch_predict

Get predictions for multiple stocks

**Request Body:**
```json
{
  "tickers": ["AAPL", "GOOGL", "MSFT"],
  "include_pdm": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "batch_timestamp": "2025-10-18T10:00:00.000Z",
    "total_predictions": 3,
    "predictions": [
      {
        "ticker_symbol": "AAPL",
        "ml_predicted_price": 152.80,
        "predicted_percentage_change": 1.70
      }
    ]
  },
  "timestamp": "2025-10-18T10:00:00.000Z"
}
```

## PDM Strategy

### GET /api/pdm_scan

Scan market for PDM strategy opportunities

**Response:**
```json
{
  "success": true,
  "data": {
    "scan_timestamp": "2025-10-18T10:00:00.000Z",
    "opportunities_found": 5,
    "pdm_signals": [
      {
        "ticker_symbol": "RELIANCE.NS",
        "signal_type": "LONG",
        "current_price": 2450.75,
        "confidence_score": 0.89,
        "price_velocity": 2.15,
        "price_curvature": -0.45,
        "volume_sensitivity": 0.002,
        "institutional_factor": 2.1,
        "atr_stop_loss": 2380.50,
        "trailing_stop": 2320.25,
        "signal_timestamp": "2025-10-18T09:45:00.000Z"
      }
    ],
    "strategy_info": {
      "name": "Price-Volume Derivatives Momentum",
      "methodology": "Calculus-based institutional momentum detection",
      "max_positions": 25,
      "min_liquidity_threshold": 1000000
    }
  },
  "timestamp": "2025-10-18T10:00:00.000Z"
}
```

### POST /api/pdm_backtest

Run PDM strategy backtest

**Request Body:**
```json
{
  "start_date": "2025-04-01",
  "end_date": "2025-10-01"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "backtest_results": {
      "strategy_return": "42.8%",
      "benchmark_return": "7.1%",
      "outperformance": "35.7%",
      "period": "2025-04-01 to 2025-10-01",
      "max_positions": 25,
      "methodology": "Calculus-based PDM with institutional volume analysis"
    },
    "execution_timestamp": "2025-10-18T10:00:00.000Z"
  },
  "timestamp": "2025-10-18T10:00:00.000Z"
}
```

## Legacy Endpoints

### GET /api/stock/:ticker

Get historical stock data (legacy support)

**Example:** `/api/stock/AAPL`

### POST /api/predict (legacy)

Legacy prediction endpoint with minimal response

**Request Body:**
```json
{
  "ticker": "AAPL"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation error",
  "details": [
    {
      "field": "ticker",
      "message": "Stock ticker symbol is required"
    }
  ],
  "timestamp": "2025-10-18T10:00:00.000Z"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "API endpoint not found",
  "requested_path": "/api/nonexistent",
  "method": "GET",
  "available_endpoints": {
    "health_check": "GET /health",
    "api_documentation": "GET /api",
    "stock_prediction": "POST /api/predict",
    "batch_prediction": "POST /api/batch_predict",
    "pdm_opportunity_scan": "GET /api/pdm_scan",
    "pdm_backtesting": "POST /api/pdm_backtest"
  },
  "timestamp": "2025-10-18T10:00:00.000Z"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many requests from this IP address. Please try again later.",
  "retry_after_minutes": 15
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "An internal server error occurred",
  "timestamp": "2025-10-18T10:00:00.000Z"
}
```

### 503 Service Unavailable
```json
{
  "success": false,
  "error": "Machine Learning service is currently unavailable. Please try again later.",
  "service_url": "http://localhost:5000",
  "timestamp": "2025-10-18T10:00:00.000Z"
}
```

## Rate Limits

- **Window**: 15 minutes
- **Max Requests**: 100 per IP address
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Response Headers

All API responses include:
- `Content-Type: application/json`
- `X-Powered-By: Roneira-AI-HIFI/2.0.0`
- `Cache-Control: no-cache` (for dynamic data)

## Testing

### cURL Examples

**Health Check:**
```bash
curl -X GET http://localhost:3001/health
```

**Stock Prediction:**
```bash
curl -X POST http://localhost:3001/api/predict \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL", "include_pdm": true}'
```

**PDM Scan:**
```bash
curl -X GET http://localhost:3001/api/pdm_scan
```

**PDM Backtest:**
```bash
curl -X POST http://localhost:3001/api/pdm_backtest \
  -H "Content-Type: application/json" \
  -d '{"start_date": "2025-04-01", "end_date": "2025-10-01"}'
```