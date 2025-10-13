import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { StatusCodes } from 'http-status-codes';
import { StockPredictionService } from '../services/stockPredictionService.js';
import { CacheService } from '../services/cacheService.js';
import { logger } from '../utils/logger.js';
import { createApiResponse } from '../utils/responseFormatter.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const router = express.Router();
const stockPredictionService = new StockPredictionService();
const cacheService = new CacheService();

/**
 * Validation middleware for stock ticker
 */
const validateTickerSymbol = [
  body('ticker')
    .notEmpty()
    .withMessage('Ticker symbol is required')
    .isString()
    .withMessage('Ticker symbol must be a string')
    .isLength({ min: 1, max: 10 })
    .withMessage('Ticker symbol must be between 1 and 10 characters')
    .matches(/^[A-Za-z0-9.-]+$/)
    .withMessage('Ticker symbol contains invalid characters'),
];

/**
 * Validation middleware for prediction days
 */
const validatePredictionDays = [
  body('days')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Prediction days must be between 1 and 30')
    .toInt(),
];

/**
 * Validation middleware for batch predictions
 */
const validateBatchTickers = [
  body('tickers')
    .isArray({ min: 1, max: 10 })
    .withMessage('Tickers must be an array with 1-10 items')
    .custom((tickers) => {
      if (!tickers.every(ticker => typeof ticker === 'string' && ticker.length >= 1 && ticker.length <= 10)) {
        throw new Error('Each ticker must be a string between 1 and 10 characters');
      }
      return true;
    }),
];

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    const errorMessages = validationErrors.array().map(error => error.msg);
    return res.status(StatusCodes.BAD_REQUEST).json(
      createApiResponse(null, false, 'Validation failed', {
        errors: errorMessages,
        receivedData: req.body
      })
    );
  }
  next();
};

/**
 * @route   GET /
 * @desc    Get API information and available endpoints
 * @access  Public
 */
router.get('/', (req, res) => {
  res.status(StatusCodes.OK).json(
    createApiResponse({
      name: 'Roneira Financial Intelligence API',
      version: '2.0.0',
      description: 'Advanced AI-driven stock price prediction and portfolio management',
      endpoints: {
        predict: 'POST /predict - Get stock price prediction',
        batchPredict: 'POST /batch-predict - Get multiple stock predictions',
        stockInfo: 'GET /stock/:ticker - Get basic stock information',
        portfolioAnalysis: 'POST /portfolio/analyze - Analyze portfolio performance'
      },
      documentation: '/api-docs'
    })
  );
});

/**
 * @route   POST /predict
 * @desc    Get AI-powered stock price prediction for a single ticker
 * @access  Public
 */
router.post('/predict',
  validateTickerSymbol,
  validatePredictionDays,
  handleValidationErrors,
  asyncWrapper(async (req, res) => {
    const startTime = Date.now();
    const { ticker, days = 1 } = req.body;
    const normalizedTicker = ticker.toUpperCase();
    
    logger.info(`Processing stock prediction request for ${normalizedTicker} (${days} days)`);
    
    try {
      // Check cache first
      const cacheKey = `prediction:${normalizedTicker}:${days}`;
      const cachedPrediction = cacheService.get(cacheKey);
      
      if (cachedPrediction) {
        logger.info(`Returning cached prediction for ${normalizedTicker}`);
        return res.status(StatusCodes.OK).json(
          createApiResponse({
            ...cachedPrediction,
            cached: true,
            responseTime: Date.now() - startTime
          })
        );
      }
      
      // Get fresh prediction from ML service
      const predictionResult = await stockPredictionService.getPrediction(normalizedTicker, days);
      
      // Cache the result
      cacheService.set(cacheKey, predictionResult, 180); // Cache for 3 minutes
      
      const responseTime = Date.now() - startTime;
      logger.info(`Stock prediction completed for ${normalizedTicker} in ${responseTime}ms`);
      
      res.status(StatusCodes.OK).json(
        createApiResponse({
          ...predictionResult,
          cached: false,
          responseTime
        })
      );
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error(`Stock prediction failed for ${normalizedTicker}`, error);
      
      const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json(
        createApiResponse(null, false, error.message, {
          ticker: normalizedTicker,
          responseTime,
          errorType: error.name || 'PredictionError'
        })
      );
    }
  })
);

/**
 * @route   POST /batch-predict
 * @desc    Get AI predictions for multiple stocks simultaneously
 * @access  Public
 */
router.post('/batch-predict',
  validateBatchTickers,
  handleValidationErrors,
  asyncWrapper(async (req, res) => {
    const startTime = Date.now();
    const { tickers } = req.body;
    const normalizedTickers = tickers.map(ticker => ticker.toUpperCase());
    
    logger.info(`Processing batch prediction for ${normalizedTickers.length} tickers: ${normalizedTickers.join(', ')}`);
    
    try {
      const batchResults = await stockPredictionService.getBatchPredictions(normalizedTickers);
      
      const responseTime = Date.now() - startTime;
      logger.info(`Batch prediction completed for ${normalizedTickers.length} tickers in ${responseTime}ms`);
      
      res.status(StatusCodes.OK).json(
        createApiResponse({
          predictions: batchResults,
          totalCount: batchResults.length,
          successCount: batchResults.filter(r => r.success).length,
          failureCount: batchResults.filter(r => !r.success).length,
          responseTime
        })
      );
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Batch prediction failed', error);
      
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
        createApiResponse(null, false, 'Batch prediction failed', {
          tickers: normalizedTickers,
          responseTime,
          errorType: error.name || 'BatchPredictionError'
        })
      );
    }
  })
);

/**
 * @route   GET /stock/:ticker
 * @desc    Get basic stock information and current market data
 * @access  Public
 */
router.get('/stock/:ticker',
  param('ticker')
    .notEmpty()
    .withMessage('Ticker symbol is required')
    .isLength({ min: 1, max: 10 })
    .withMessage('Ticker symbol must be between 1 and 10 characters'),
  handleValidationErrors,
  asyncWrapper(async (req, res) => {
    const { ticker } = req.params;
    const normalizedTicker = ticker.toUpperCase();
    
    logger.info(`Fetching stock information for ${normalizedTicker}`);
    
    try {
      const stockInfo = await stockPredictionService.getStockInfo(normalizedTicker);
      
      res.status(StatusCodes.OK).json(
        createApiResponse(stockInfo)
      );
      
    } catch (error) {
      logger.error(`Failed to fetch stock info for ${normalizedTicker}`, error);
      
      const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
      res.status(statusCode).json(
        createApiResponse(null, false, error.message, {
          ticker: normalizedTicker,
          errorType: error.name || 'StockInfoError'
        })
      );
    }
  })
);

export default router;