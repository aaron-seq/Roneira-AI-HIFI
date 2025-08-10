# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import time

app = Flask(__name__)
CORS(app) # Allow requests from your frontend

@app.route('/predict', methods=['POST'])
def predict():
    """
    This is a mock prediction endpoint.
    In a real application, this is where you would:
    1. Get the stock symbol from the request.
    2. Fetch historical data for that stock.
    3. Preprocess the data.
    4. Load your trained machine learning model (e.g., LSTM, ARIMA).
    5. Make a prediction.
    6. Perform peer analysis.
    7. Return the structured prediction.
    """
    data = request.get_json()
    stock_symbol = data.get('stock_symbol')
    
    print(f"Received prediction request for: {stock_symbol}")
    
    # Simulate ML model processing time
    time.sleep(1.5) 
    
    # --- MOCK RESPONSE ---
    # This simulates the output of a real ML model
    base_price = np.random.uniform(100, 5000)
    
    prediction = {
        "priceTarget": round(base_price * np.random.uniform(1.05, 1.2), 2),
        "confidenceScore": np.random.randint(75, 95),
        "marketValueTarget": f"{round(base_price * 1.08, 2)} - {round(base_price * 1.15, 2)}",
        "indicators": {
            "shortTerm": np.random.choice(['Buy', 'Strong Buy', 'Hold']),
            "longTerm": np.random.choice(['Buy', 'Strong Buy'])
        },
        "peerComparison": [
            {"name": "Peer A", "valuation": "High", "durability": "High", "momentum": "Medium"},
            {"name": "Peer B", "valuation": "Medium", "durability": "High", "momentum": "High"},
            {"name": "Peer C", "valuation": "High", "durability": "Medium", "momentum": "Medium"},
            {"name": "Peer D", "valuation": "Low", "durability": "High", "momentum": "Low"},
        ]
    }
    
    print(f"Generated prediction for {stock_symbol}: Target ${prediction['priceTarget']}")
    
    return jsonify(prediction)

if __name__ == '__main__':
    # Runs the ML service on port 5000
    app.run(debug=True, port=5000)

