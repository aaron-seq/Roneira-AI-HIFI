HF_API_URL = "https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium"
HF_API_KEY = os.getenv("HUGGING_FACE_API_KEY", "")  # Optional for public models

# In-memory cache for trained models
model_cache = {}
prediction_cache = {}

# Free financial data sources
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")  # Free tier: 5 calls/min


def get_stock_sentiment(ticker_symbol, company_name):
    """
    Get sentiment analysis for stock using Hugging Face free API
    """
    try:
        # Create a prompt for sentiment analysis
        text = f"The stock {ticker_symbol} ({company_name}) market outlook and investor sentiment analysis"

        headers = {"Authorization": f"Bearer {HF_API_KEY}" if HF_API_KEY else None}

        # Use free sentiment analysis model
        sentiment_url = "https://api-inference.huggingface.co/models/ProsusAI/finbert"

        response = requests.post(
            sentiment_url, headers=headers, json={"inputs": text}, timeout=10
        )

        if response.status_code == 200:
            sentiment_data = response.json()
            return (
                sentiment_data[0]
                if sentiment_data
                else {"label": "NEUTRAL", "score": 0.5}
            )
        else:
            logger.warning(f"Sentiment API failed: {response.status_code}")
            return {"label": "NEUTRAL", "score": 0.5}

    except Exception as e:
        logger.error(f"Sentiment analysis error: {e}")
        return {"label": "NEUTRAL", "score": 0.5}


def get_technical_indicators(stock_data):
    """
    Calculate technical indicators for better predictions
    """
    try:
        # Simple Moving Averages
        stock_data["SMA_5"] = stock_data["Close"].rolling(window=5).mean()
        stock_data["SMA_20"] = stock_data["Close"].rolling(window=20).mean()

        # RSI (Relative Strength Index)
        delta = stock_data["Close"].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        stock_data["RSI"] = 100 - (100 / (1 + rs))

        # MACD
        exp1 = stock_data["Close"].ewm(span=12).mean()
        exp2 = stock_data["Close"].ewm(span=26).mean()
        stock_data["MACD"] = exp1 - exp2
        stock_data["MACD_Signal"] = stock_data["MACD"].ewm(span=9).mean()

        # Bollinger Bands
        stock_data["BB_Middle"] = stock_data["Close"].rolling(window=20).mean()
        bb_std = stock_data["Close"].rolling(window=20).std()
        stock_data["BB_Upper"] = stock_data["BB_Middle"] + (bb_std * 2)
        stock_data["BB_Lower"] = stock_data["BB_Middle"] - (bb_std * 2)

        return stock_data

    except Exception as e:
        logger.error(f"Technical indicators calculation error: {e}")
        return stock_data


def create_advanced_model(ticker_symbol):
    """
    Create an advanced ML model with multiple features
    """
    try:
        # Fetch more historical data for better training
        end_date = datetime.now()
        start_date = end_date - timedelta(days=730)  # 2 years of data

        stock_data = yf.download(
            ticker_symbol,
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
        )

        if stock_data.empty:
            logger.warning(f"No data found for ticker: {ticker_symbol}")
            return None

        # Add technical indicators
        stock_data = get_technical_indicators(stock_data)

        # Prepare features (remove NaN values)
        stock_data = stock_data.dropna()

        if len(stock_data) < 50:  # Need sufficient data
            logger.warning(f"Insufficient data for {ticker_symbol}")
            return None

        # Feature engineering
        features = [
            "Open",
            "High",
            "Low",
            "Volume",
            "SMA_5",
            "SMA_20",
            "RSI",
            "MACD",
            "BB_Middle",
        ]
        available_features = [f for f in features if f in stock_data.columns]

        X = stock_data[available_features].values
        y = stock_data["Close"].values

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        # Use Random Forest for better performance
        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)

        # Calculate model accuracy
        train_score = model.score(X_train, y_train)
        test_score = model.score(X_test, y_test)

        model_info = {
            "model": model,
            "features": available_features,
            "train_score": train_score,
            "test_score": test_score,
            "last_trained": datetime.now().isoformat(),
        }

        model_cache[ticker_symbol] = model_info
        logger.info(
            f"Advanced model for {ticker_symbol} trained. Test Score: {test_score:.4f}"
        )

        return model_info

    except Exception as e:
        logger.error(f"Advanced model training error for {ticker_symbol}: {e}")
        return None


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return (
        jsonify(
            {
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "models_cached": len(model_cache),
            }
        ),
        200,
    )


@app.route("/predict", methods=["POST"])
def predict_stock_price():
    """
    Enhanced API endpoint for stock price prediction
    """
    try:
        request_data = request.get_json()
        ticker_symbol = request_data.get("ticker")
        prediction_days = request_data.get("days", 1)  # Default to 1 day

        if not ticker_symbol:
            return jsonify({"error": "Ticker symbol is required."}), 400

        ticker_symbol = ticker_symbol.upper()

        # Check cache first
        cache_key = f"{ticker_symbol}_{prediction_days}"
        if cache_key in prediction_cache:
            cached_prediction = prediction_cache[cache_key]
            cache_time = datetime.fromisoformat(cached_prediction["timestamp"])
            if (datetime.now() - cache_time).seconds < 300:  # 5 minutes cache
                logger.info(f"Returning cached prediction for {ticker_symbol}")
                return jsonify(cached_prediction), 200

        # Get or create model
        if ticker_symbol in model_cache:
            model_info = model_cache[ticker_symbol]
            logger.info(f"Using cached model for {ticker_symbol}")
        else:
            model_info = create_advanced_model(ticker_symbol)
            if model_info is None:
                return (
                    jsonify(
                        {
                            "error": f"Could not create prediction model for {ticker_symbol}"
                        }
                    ),
                    500,
                )

        # Fetch recent data for prediction
        recent_data = yf.download(ticker_symbol, period="60d")
        if recent_data.empty:
            return (
                jsonify({"error": f"Could not fetch recent data for {ticker_symbol}"}),
                404,
            )

        # Add technical indicators
        recent_data = get_technical_indicators(recent_data)
        recent_data = recent_data.dropna()

        if len(recent_data) == 0:
            return (
                jsonify({"error": f"Insufficient recent data for {ticker_symbol}"}),
                404,
            )

        # Prepare prediction features
        latest_features = (
            recent_data[model_info["features"]].iloc[-1].values.reshape(1, -1)
        )

        # Make prediction
        predicted_price = model_info["model"].predict(latest_features)[0]

        # Get current price and calculate change
        current_price = recent_data["Close"].iloc[-1]
        price_change = predicted_price - current_price
        percentage_change = (price_change / current_price) * 100

        # Get company info for sentiment analysis
        try:
            ticker_info = yf.Ticker(ticker_symbol)
            company_name = ticker_info.info.get("longName", ticker_symbol)
        except Exception:
            company_name = ticker_symbol

        # Get sentiment analysis (FREE)
        sentiment = get_stock_sentiment(ticker_symbol, company_name)

        # Prepare response
        response = {
            "ticker": ticker_symbol,
            "company_name": company_name,
            "current_price": round(float(current_price), 2),
            "predicted_price": round(float(predicted_price), 2),
            "price_change": round(float(price_change), 2),
            "percentage_change": round(float(percentage_change), 2),
            "prediction_days": prediction_days,
            "model_accuracy": round(model_info["test_score"], 4),
            "sentiment": sentiment,
            "timestamp": datetime.now().isoformat(),
            "technical_indicators": {
                "rsi": (
                    round(float(recent_data["RSI"].iloc[-1]), 2)
                    if "RSI" in recent_data.columns
                    else None
                ),
                "sma_5": (
                    round(float(recent_data["SMA_5"].iloc[-1]), 2)
                    if "SMA_5" in recent_data.columns
                    else None
                ),
                "sma_20": (
                    round(float(recent_data["SMA_20"].iloc[-1]), 2)
                    if "SMA_20" in recent_data.columns
                    else None
                ),
            },
        }

        # Cache the response
        prediction_cache[cache_key] = response

        logger.info(f"Prediction completed for {ticker_symbol}: {predicted_price:.2f}")
        return jsonify(response), 200

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return (
            jsonify({"error": "An internal server error occurred during prediction"}),
            500,
        )


@app.route("/batch_predict", methods=["POST"])
def batch_predict():
    """
    Predict multiple stocks at once
    """
    try:
        request_data = request.get_json()
        tickers = request_data.get("tickers", [])

        if not tickers or len(tickers) == 0:
            return jsonify({"error": "Ticker list is required"}), 400

        if len(tickers) > 10:  # Limit batch size
            return jsonify({"error": "Maximum 10 tickers allowed per batch"}), 400

        predictions = []

        for ticker in tickers:
            try:
                # Make individual prediction
                single_request = {"ticker": ticker}

                # Simulate single prediction call
                request.json = single_request
                response = predict_stock_price()

                if response[1] == 200:  # Success status code
                    predictions.append(response[0].json)
                else:
                    predictions.append(
                        {
                            "ticker": ticker,
                            "error": "Prediction failed",
                            "timestamp": datetime.now().isoformat(),
                        }
                    )

            except Exception as e:
                predictions.append(
                    {
                        "ticker": ticker,
                        "error": str(e),
                        "timestamp": datetime.now().isoformat(),
                    }
                )

        return (
            jsonify(
                {
                    "predictions": predictions,
                    "total_count": len(predictions),
                    "timestamp": datetime.now().isoformat(),
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        return jsonify({"error": "Batch prediction failed"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
