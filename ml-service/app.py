import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
import yfinance as yf
from flask_cors import CORS

# Initialize the Flask application
app = Flask(__name__)
CORS(app) # Enable Cross-Origin Resource Sharing

# In-memory cache for trained models to avoid retraining on every request
model_cache = {}

def create_and_train_model(ticker_symbol):
    """
    Fetches historical stock data, trains a linear regression model,
    and caches it.

    Args:
        ticker_symbol (str): The stock ticker symbol.

    Returns:
        LinearRegression or None: The trained model if successful, otherwise None.
    """
    try:
        # Fetch historical data from Yahoo Finance
        stock_data = yf.download(ticker_symbol, start='2020-01-01', end=pd.to_datetime('today').strftime('%Y-%m-%d'))
        
        if stock_data.empty:
            print(f"No data found for ticker: {ticker_symbol}")
            return None

        # Feature Engineering: Use 'Open' price to predict 'Close' price
        # For a more robust model, more features should be engineered (e.g., moving averages, RSI)
        stock_data['Date'] = stock_data.index
        stock_data = stock_data[['Date', 'Open', 'Close']].copy()

        # Prepare the data for the model
        # Using .values reshapes the data into the format sklearn expects
        X = np.array(stock_data['Open']).reshape(-1, 1)
        y = np.array(stock_data['Close']).reshape(-1, 1)

        # Split data into training and testing sets
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        # Create and train the Linear Regression model
        model = LinearRegression()
        model.fit(X_train, y_train)
        
        # Cache the trained model
        model_cache[ticker_symbol] = model
        print(f"Model for {ticker_symbol} trained and cached.")
        
        return model

    except Exception as e:
        print(f"An error occurred during model training for {ticker_symbol}: {e}")
        return None

@app.route('/predict', methods=['POST'])
def predict_stock_price():
    """
    API endpoint to predict the next day's closing stock price.
    """
    try:
        request_data = request.get_json()
        ticker_symbol = request_data.get('ticker')

        if not ticker_symbol:
            return jsonify({'error': 'Ticker symbol is required.'}), 400

        # Check if a model for this ticker is already cached
        if ticker_symbol in model_cache:
            model = model_cache[ticker_symbol]
            print(f"Using cached model for {ticker_symbol}.")
        else:
            model = create_and_train_model(ticker_symbol)
            if model is None:
                return jsonify({'error': f'Could not create a prediction model for {ticker_symbol}.'}), 500

        # Fetch the most recent 'Open' price to make a prediction
        latest_data = yf.download(ticker_symbol, period='1d')
        if latest_data.empty:
            return jsonify({'error': f'Could not fetch latest data for {ticker_symbol}.'}), 404
            
        latest_open_price = latest_data['Open'].iloc[-1]
        
        # Predict the next closing price
        predicted_price = model.predict(np.array([[latest_open_price]]))
        
        # Prepare and send the response
        response = {
            'ticker': ticker_symbol,
            'predicted_close_price': round(predicted_price[0][0], 2),
            'last_open_price': round(latest_open_price, 2)
        }
        return jsonify(response), 200

    except Exception as e:
        print(f"An error occurred during prediction: {e}")
        return jsonify({'error': 'An internal server error occurred.'}), 500

if __name__ == '__main__':
    # Running in debug mode is not recommended for production
    app.run(port=8000, debug=True)
