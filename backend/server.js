// Import necessary modules
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const yfinance = require('yahoo-finance2').default;

// Initialize the Express application
const app = express();
const PORT = process.env.PORT || 5000;
const ML_API_URL = 'http://localhost:8000/predict';

// Apply middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON request bodies

/**
 * @route   GET /api/stock/:ticker
 * @desc    Get historical stock data for a given ticker symbol
 * @access  Public
 */
app.get('/api/stock/:ticker', async (request, response) => {
    try {
        const { ticker } = request.params;
        const queryOptions = {
            period1: '2020-01-01', // Start date for historical data
        };

        console.log(`Fetching historical data for ${ticker}`);
        const historicalData = await yfinance.historical(ticker, queryOptions);

        if (!historicalData || historicalData.length === 0) {
            return response.status(404).json({ message: 'Stock data not found for the given ticker.' });
        }

        response.status(200).json(historicalData);
    } catch (error) {
        console.error('Error fetching stock data:', error.message);
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            return response.status(error.response.status).json({ message: 'External API returned an error.', details: error.message });
        } else if (error.request) {
            // The request was made but no response was received
            return response.status(503).json({ message: 'Could not connect to the stock data service.' });
        }
        // Something happened in setting up the request that triggered an Error
        response.status(500).json({ message: 'An internal server error occurred.' });
    }
});

/**
 * @route   POST /api/predict
 * @desc    Get stock price prediction from the ML service
 * @access  Public
 */
app.post('/api/predict', async (request, response) => {
    try {
        const { ticker } = request.body;

        if (!ticker) {
            return response.status(400).json({ message: 'Ticker symbol is required.' });
        }

        console.log(`Requesting prediction for ${ticker}`);
        
        // Forward the request to the Python ML service
        const predictionResponse = await axios.post(ML_API_URL, {
            ticker: ticker
        });

        response.status(200).json(predictionResponse.data);
    } catch (error) {
        console.error('Error getting prediction:', error.message);
        if (error.code === 'ECONNREFUSED') {
             return response.status(503).json({ message: 'The prediction service is currently unavailable.' });
        }
        response.status(500).json({ message: 'An internal server error occurred while fetching the prediction.' });
    }
});


// Centralized Error Handling for routes that don't exist
app.use((req, res, next) => {
    res.status(404).json({ message: "API endpoint not found." });
});

// Start the server
app.listen(PORT, () => {
    console.log(`✅ Backend server is running on http://localhost:${PORT}`);
});
