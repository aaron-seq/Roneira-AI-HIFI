// Import necessary modules
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

// Initialize the Express application
const app = express();
const PORT = process.env.PORT || 5000;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Apply middleware
app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Backend API',
        version: '1.0.0'
    });
});

// API Routes
app.get('/api', (req, res) => {
    res.status(200).json({
        message: 'Roneira AI HIFI Backend API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            predict: 'POST /api/predict',
            batch_predict: 'POST /api/batch_predict',
            stock_data: 'GET /api/stock/:ticker'
        }
    });
});

/**
 * @route   POST /api/predict
 * @desc    Get stock price prediction from the ML service
 * @access  Public
 */
app.post('/api/predict', async (request, response) => {
    try {
        const { ticker, days = 1 } = request.body;

        if (!ticker) {
            return response.status(400).json({ 
                error: 'Ticker symbol is required.',
                example: { ticker: 'AAPL', days: 1 }
            });
        }

        console.log(`Requesting prediction for ${ticker} (${days} days)`);
        
        // Forward the request to the Python ML service
        const predictionResponse = await axios.post(`${ML_SERVICE_URL}/predict`, {
            ticker: ticker.toUpperCase(),
            days: days
        }, {
            timeout: 30000, // 30 second timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });

        response.status(200).json(predictionResponse.data);
    } catch (error) {
        console.error('Error getting prediction:', error.message);
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return response.status(503).json({ 
                error: 'The ML prediction service is currently unavailable. Please try again later.',
                service_url: ML_SERVICE_URL
            });
        }
        
        if (error.response) {
            return response.status(error.response.status).json({
                error: error.response.data?.error || 'ML service returned an error',
                details: error.response.data
            });
        }
        
        response.status(500).json({ 
            error: 'An internal server error occurred while fetching the prediction.',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route   POST /api/batch_predict
 * @desc    Get predictions for multiple stocks
 * @access  Public
 */
app.post('/api/batch_predict', async (request, response) => {
    try {
        const { tickers } = request.body;

        if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
            return response.status(400).json({ 
                error: 'Tickers array is required.',
                example: { tickers: ['AAPL', 'GOOGL', 'MSFT'] }
            });
        }

        if (tickers.length > 10) {
            return response.status(400).json({ 
                error: 'Maximum 10 tickers allowed per batch request.' 
            });
        }

        console.log(`Requesting batch prediction for ${tickers.length} tickers`);
        
        // Forward the request to the Python ML service
        const predictionResponse = await axios.post(`${ML_SERVICE_URL}/batch_predict`, {
            tickers: tickers.map(t => t.toUpperCase())
        }, {
            timeout: 60000, // 60 second timeout for batch
            headers: {
                'Content-Type': 'application/json'
            }
        });

        response.status(200).json(predictionResponse.data);
    } catch (error) {
        console.error('Error getting batch prediction:', error.message);
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return response.status(503).json({ 
                error: 'The ML prediction service is currently unavailable.' 
            });
        }
        
        if (error.response) {
            return response.status(error.response.status).json({
                error: error.response.data?.error || 'ML service returned an error',
                details: error.response.data
            });
        }
        
        response.status(500).json({ 
            error: 'An internal server error occurred during batch prediction.' 
        });
    }
});

/**
 * @route   GET /api/stock/:ticker
 * @desc    Get basic stock information (delegated to ML service)
 * @access  Public
 */
app.get('/api/stock/:ticker', async (request, response) => {
    try {
        const { ticker } = request.params;
        
        if (!ticker) {
            return response.status(400).json({ error: 'Ticker parameter is required.' });
        }

        console.log(`Fetching stock info for ${ticker}`);
        
        // This could be expanded to use a dedicated stock data service
        // For now, we'll return basic info
        response.status(200).json({
            ticker: ticker.toUpperCase(),
            message: 'Use /api/predict endpoint for detailed stock analysis',
            endpoints: {
                predict: `POST /api/predict with body: {"ticker": "${ticker.toUpperCase()}"}`
            }
        });
        
    } catch (error) {
        console.error('Error fetching stock data:', error.message);
        response.status(500).json({ 
            error: 'An internal server error occurred.' 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'An internal server error occurred.',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: "API endpoint not found.",
        available_endpoints: {
            health: 'GET /health',
            api_info: 'GET /api',
            predict: 'POST /api/predict',
            batch_predict: 'POST /api/batch_predict',
            stock_info: 'GET /api/stock/:ticker'
        }
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Backend server is running on port ${PORT}`);
    console.log(`🔗 ML Service URL: ${ML_SERVICE_URL}`);
    console.log(`🌐 CORS Origin: ${CORS_ORIGIN}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});