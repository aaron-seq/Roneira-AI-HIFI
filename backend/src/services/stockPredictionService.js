import axios from 'axios';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

/**
 * Service class for handling stock prediction operations
 * Communicates with the ML service and handles business logic
 */
export class StockPredictionService {
  constructor() {
    this.mlServiceUrl = config.mlService.url;
    this.timeout = config.mlService.timeout;
    this.retryAttempts = config.mlService.retryAttempts;
    this.retryDelay = config.mlService.retryDelay;
    
    // Configure axios instance for ML service
    this.mlServiceClient = axios.create({
      baseURL: this.mlServiceUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Roneira-Backend/2.0.0'
      }
    });

    // Add request interceptor for logging
    this.mlServiceClient.interceptors.request.use(
      (requestConfig) => {
        logger.info(`Making ML service request: ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`);
        return requestConfig;
      },
      (error) => {
        logger.error('ML service request error', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.mlServiceClient.interceptors.response.use(
      (response) => {
        logger.info(`ML service response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`ML service response error: ${error.response?.status || 'NO_RESPONSE'} ${error.config?.url}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Sleep utility for retry delays
   */
  async sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  /**
   * Retry mechanism for ML service calls
   */
  async retryRequest(requestFunction, attempts = this.retryAttempts) {
    let lastError;
    
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await requestFunction();
      } catch (error) {
        lastError = error;
        
        if (attempt === attempts) {
          break;
        }
        
        // Only retry on network errors or 5xx server errors
        if (this.shouldRetry(error)) {
          const delay = this.retryDelay * attempt;
          logger.warn(`ML service request failed (attempt ${attempt}/${attempts}), retrying in ${delay}ms`, {
            error: error.message,
            status: error.response?.status
          });
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Determines if an error should trigger a retry
   */
  shouldRetry(error) {
    // Retry on network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Retry on 5xx server errors
    if (error.response && error.response.status >= 500) {
      return true;
    }
    
    return false;
  }

  /**
   * Get stock price prediction from ML service
   * @param {string} tickerSymbol - Stock ticker symbol
   * @param {number} predictionDays - Number of days to predict
   * @returns {Promise<object>} Prediction result
   */
  async getPrediction(tickerSymbol, predictionDays = 1) {
    try {
      const requestFunction = () => this.mlServiceClient.post('/predict', {
        ticker: tickerSymbol,
        days: predictionDays
      });

      const response = await this.retryRequest(requestFunction);
      
      // Validate response data
      if (!response.data) {
        throw new Error('Empty response from ML service');
      }

      return {
        ticker: tickerSymbol,
        predictionDays,
        ...response.data,
        source: 'ml-service',
        processedAt: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`Stock prediction failed for ${tickerSymbol}`, error);
      
      // Transform ML service errors to application errors
      const transformedError = this.transformMlServiceError(error, tickerSymbol);
      throw transformedError;
    }
  }

  /**
   * Get batch predictions for multiple stocks
   * @param {string[]} tickerSymbols - Array of ticker symbols
   * @returns {Promise<object[]>} Array of prediction results
   */
  async getBatchPredictions(tickerSymbols) {
    try {
      const requestFunction = () => this.mlServiceClient.post('/batch_predict', {
        tickers: tickerSymbols
      });

      const response = await this.retryRequest(requestFunction);
      
      if (!response.data || !response.data.predictions) {
        throw new Error('Invalid batch response from ML service');
      }

      return response.data.predictions.map(prediction => ({
        ...prediction,
        source: 'ml-service',
        processedAt: new Date().toISOString()
      }));
      
    } catch (error) {
      logger.error('Batch prediction failed', error, { tickers: tickerSymbols });
      
      // If batch fails, try individual predictions as fallback
      if (tickerSymbols.length <= 3) {
        logger.info('Attempting individual predictions as fallback');
        return this.getFallbackBatchPredictions(tickerSymbols);
      }
      
      throw this.transformMlServiceError(error, tickerSymbols.join(','));
    }
  }

  /**
   * Fallback method for batch predictions using individual calls
   */
  async getFallbackBatchPredictions(tickerSymbols) {
    const results = [];
    
    for (const ticker of tickerSymbols) {
      try {
        const prediction = await this.getPrediction(ticker, 1);
        results.push({
          ticker,
          success: true,
          ...prediction
        });
      } catch (error) {
        results.push({
          ticker,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  /**
   * Get basic stock information
   * @param {string} tickerSymbol - Stock ticker symbol
   * @returns {Promise<object>} Stock information
   */
  async getStockInfo(tickerSymbol) {
    // For now, return basic info with a recommendation to use prediction endpoint
    // This can be enhanced to call a dedicated stock info service
    return {
      ticker: tickerSymbol,
      message: 'Use the /predict endpoint for comprehensive stock analysis and predictions',
      availableEndpoints: {
        predict: `POST /api/v1/predict with body: {"ticker": "${tickerSymbol}"}`,
        batchPredict: 'POST /api/v1/batch-predict for multiple stocks'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Transform ML service errors into application-specific errors
   */
  transformMlServiceError(error, ticker) {
    const appError = new Error();
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      appError.message = 'The ML prediction service is currently unavailable. Please try again later.';
      appError.statusCode = 503;
      appError.name = 'ServiceUnavailableError';
    } else if (error.code === 'ETIMEDOUT') {
      appError.message = 'The ML prediction service request timed out. Please try again.';
      appError.statusCode = 504;
      appError.name = 'ServiceTimeoutError';
    } else if (error.response) {
      appError.message = error.response.data?.error || `ML service returned an error (${error.response.status})`;
      appError.statusCode = error.response.status;
      appError.name = 'MlServiceError';
    } else {
      appError.message = 'An unexpected error occurred while processing the prediction request.';
      appError.statusCode = 500;
      appError.name = 'InternalServiceError';
    }
    
    appError.ticker = ticker;
    appError.originalError = error.message;
    
    return appError;
  }
}