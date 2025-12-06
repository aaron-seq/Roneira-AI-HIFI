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

// --- PDM Strategy Endpoints (Proxy to ML Service) ---

/**
 * @route   GET /api/pdm/signals
 * @desc    Get PDM strategy signals from ML service
 * @access  Public
 */
app.get('/api/pdm/signals', async (req, res) => {
    try {
        console.log('Fetching PDM signals from ML service...');
        const response = await axios.get(`${ML_SERVICE_URL}/pdm_scan`, {
            timeout: 30000
        });
        res.status(200).json({ data: response.data });
    } catch (error) {
        console.error('Error fetching PDM signals:', error.message);
        // Fallback mock data if ML service is down
        res.status(200).json({
            data: {
                pdm_signals: [],
                opportunities_found: 0,
                message: "ML Service unavailable, showing cached/empty data"
            }
        });
    }
});

/**
 * @route   POST /api/pdm/backtest
 * @desc    Execute PDM backtest via ML service
 * @access  Public
 */
app.post('/api/pdm/backtest', async (req, res) => {
    try {
        const response = await axios.post(`${ML_SERVICE_URL}/pdm_backtest`, req.body, {
            timeout: 60000
        });
        res.status(200).json({ data: response.data });
    } catch (error) {
        console.error('Error executing PDM backtest:', error.message);
        res.status(503).json({ error: 'PDM Service unavailable' });
    }
});

// --- Portfolio Endpoints (File-based Persistence) ---

const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, 'data');
const PORTFOLIO_FILE = path.join(DATA_DIR, 'portfolio.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to read portfolio
const readPortfolio = () => {
    if (!fs.existsSync(PORTFOLIO_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
};

// Helper to write portfolio
const writePortfolio = (data) => {
    fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(data, null, 2));
};

/**
 * @route   GET /api/portfolio/:userId
 * @desc    Get user portfolio
 * @access  Public (Demo)
 */
app.get('/api/portfolio/:userId', (req, res) => {
    const { userId } = req.params;
    const allPortfolios = readPortfolio();
    const userPortfolio = allPortfolios.find(p => p.userId === userId);

    res.status(200).json({
        data: userPortfolio ? userPortfolio.portfolio : []
    });
});

/**
 * @route   POST /api/portfolio/:userId/update
 * @desc    Update user portfolio (Buy/Sell)
 * @access  Public (Demo)
 */
app.post('/api/portfolio/:userId/update', (req, res) => {
    const { userId } = req.params;
    const { ticker, shares, price, action } = req.body; // action: 'add' | 'remove'

    let allPortfolios = readPortfolio();
    let userEntry = allPortfolios.find(p => p.userId === userId);

    if (!userEntry) {
        userEntry = { userId, portfolio: [] };
        allPortfolios.push(userEntry);
    }

    if (action === 'add') {
        const existingItem = userEntry.portfolio.find(p => p.ticker === ticker);
        if (existingItem) {
            // Update average price
            const totalCost = (existingItem.shares * existingItem.avg_price) + (shares * price);
            const totalShares = existingItem.shares + shares;
            existingItem.shares = totalShares;
            existingItem.avg_price = totalCost / totalShares;
        } else {
            userEntry.portfolio.push({ ticker, shares, avg_price: price });
        }
    } else if (action === 'remove') {
        userEntry.portfolio = userEntry.portfolio.filter(p => p.ticker !== ticker);
    }

    writePortfolio(allPortfolios);
    res.status(200).json({ data: userEntry.portfolio });
});

// --- News Endpoint (Mocked) ---

/**
 * @route   GET /api/news
 * @desc    Get market news
 * @access  Public
 */
app.get('/api/news', (req, res) => {
    const news = [
        {
            id: 1,
            title: "Market Rally Continues as Tech Stocks Surge",
            source: "Financial Times",
            summary: "Major indices hit new highs driven by AI sector growth.",
            url: "#",
            timestamp: new Date().toISOString(),
            sentiment: "Positive"
        },
        {
            id: 2,
            title: "Fed Signals Potential Rate Cuts Later This Year",
            source: "Bloomberg",
            summary: "Federal Reserve officials hint at easing monetary policy if inflation data cooperates.",
            url: "#",
            timestamp: new Date().toISOString(),
            sentiment: "Neutral"
        },
        {
            id: 3,
            title: "Oil Prices Stabilize After Volatile Week",
            source: "Reuters",
            summary: "Global supply constraints balance with demand concerns.",
            url: "#",
            timestamp: new Date().toISOString(),
            sentiment: "Neutral"
        },
        {
            id: 4,
            title: "New Electric Vehicle Subsidy Program Announced",
            source: "CNBC",
            summary: "Government unveils new incentives for EV manufacturers and buyers.",
            url: "#",
            timestamp: new Date().toISOString(),
            sentiment: "Positive"
        }
    ];

    res.status(200).json({ data: news });
});