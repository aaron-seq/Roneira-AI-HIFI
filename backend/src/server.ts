/**
 * Roneira AI HIFI - Enhanced Backend Server with TypeScript
 * 
 * Features:
 * - RESTful API for stock predictions
 * - PDM strategy integration
 * - Error handling and validation
 * - Health monitoring
 * - CORS configuration
 * 
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import express, { Request, Response, NextFunction, Application } from 'express';
import { body, validationResult } from 'express-validator';
import axios, { AxiosError } from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import marketRoutes from './routes/marketRoutes.js';
const logger = require('./utils/logger');
import { sendSuccess, sendError } from './utils/response';

// Load environment variables
dotenv.config();

// Type definitions
interface StockPredictionRequest {
  ticker: string;
  days?: number;
  include_pdm?: boolean;
}

interface BatchPredictionRequest {
  tickers: string[];
  include_pdm?: boolean;
}

interface PDMBacktestRequest {
  start_date?: string;
  end_date?: string;
}

interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

interface HealthCheckResponse {
  service_status: string;
  timestamp: string;
  environment: string;
  version: string;
  ml_service_status: string;
  uptime_seconds: number;
}

// Application configuration
class ApplicationConfiguration {
  public readonly port: number;
  public readonly machinelearning_service_url: string;
  public readonly cors_allowed_origins: string;
  public readonly node_environment: string;
  public readonly rate_limit_window_minutes: number;
  public readonly rate_limit_max_requests: number;

  constructor() {
    this.port = parseInt(process.env.PORT || '3001', 10);
    this.machinelearning_service_url = process.env.ML_SERVICE_URL || 'http://ml-service:5000';
    this.cors_allowed_origins = process.env.CORS_ORIGIN || 'http://localhost:3000';
    this.node_environment = process.env.NODE_ENV || 'development';
    this.rate_limit_window_minutes = 15;
    this.rate_limit_max_requests = 100;
  }
}

class BackendServer {
  private application: Application;
  private configuration: ApplicationConfiguration;
  private server_start_time: Date;

  constructor() {
    this.application = express();
    this.configuration = new ApplicationConfiguration();
    this.server_start_time = new Date();

    this.initialize_middleware();
    this.initialize_routes();
    this.initialize_error_handlers();
  }

  private initialize_middleware(): void {
    this.application.use(helmet());
    this.application.use(compression());

    if (this.configuration.node_environment !== 'test') {
      this.application.use(morgan('combined', {
        stream: {
          write: (message: string) => logger.info(message.trim()),
        },
      }));
    }

    this.application.use(cors({
      origin: this.configuration.cors_allowed_origins.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    const rate_limiter = rateLimit({
      windowMs: this.configuration.rate_limit_window_minutes * 60 * 1000,
      max: this.configuration.rate_limit_max_requests,
      message: {
        error: 'Too many requests from this IP address. Please try again later.',
        retry_after_minutes: this.configuration.rate_limit_window_minutes
      },
      standardHeaders: true,
      legacyHeaders: false
    });

    this.application.use('/api/', rate_limiter);
    this.application.use(express.json({ limit: '10mb' }));
    this.application.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  private initialize_routes(): void {
    this.application.get('/health', this.handle_health_check.bind(this));
    this.application.get('/api', this.handle_api_information.bind(this));

    // Handles /quote/:symbol, /timeseries/:symbol
    this.application.use('/api/market', marketRoutes);      // Handles /overview, /movers

    // Stock prediction endpoints
    this.application.post(
      '/api/predict',
      body('ticker').isString().notEmpty(),
      this.handle_stock_prediction.bind(this)
    );

    this.application.post('/api/batch_predict', this.handle_batch_prediction.bind(this));
    this.application.get('/api/pdm_scan', this.handle_pdm_opportunity_scan.bind(this));
    this.application.post('/api/pdm_backtest', this.handle_pdm_backtest.bind(this));
    this.application.get('/api/portfolio/:user_id', this.handle_get_portfolio.bind(this));
    this.application.post('/api/portfolio/:user_id/update', this.handle_update_portfolio.bind(this));
    this.application.post('/api/auth/login', (req, res) => sendSuccess(res, { message: 'Login successful' }));
    this.application.post('/api/auth/register', (req, res) => sendSuccess(res, { message: 'Registration successful' }));
  }

  private initialize_error_handlers(): void {
    this.application.use(this.handle_not_found.bind(this));
    this.application.use(this.handle_server_error.bind(this));
  }

  private async handle_health_check(request: Request, response: Response): Promise<void> {
    try {
      let ml_service_status = 'unknown';
      try {
        const ml_health_response = await axios.get(
          `${this.configuration.machinelearning_service_url}/health`,
          { timeout: 5000 }
        );
        ml_service_status = ml_health_response.status === 200 ? 'healthy' : 'unhealthy';
      } catch (error) {
        ml_service_status = 'unhealthy';
      }

      const uptime_seconds = Math.floor((Date.now() - this.server_start_time.getTime()) / 1000);

      const health_status: HealthCheckResponse = {
        service_status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: this.configuration.node_environment,
        version: '2.0.0',
        ml_service_status: ml_service_status,
        uptime_seconds: uptime_seconds
      };

      sendSuccess(response, health_status);
    } catch (error) {
      logger.error('Health check error:', error);
      sendError(response, 'Health check failed', 500);
    }
  }

  private handle_api_information(request: Request, response: Response): void {
    const api_documentation = {
      service_name: 'Roneira AI HIFI Backend API',
      version: '2.0.0',
      description: 'Advanced financial intelligence platform with PDM strategy integration',
      endpoints: {
        health_check: 'GET /health',
        market_overview: 'GET /api/market/overview',
        market_quote: 'GET /api/market/quote/:symbol',
        market_movers: 'GET /api/market/movers',
        stock_prediction: 'POST /api/predict',
        batch_prediction: 'POST /api/batch_predict',
        pdm_opportunity_scan: 'GET /api/pdm_scan',
        pdm_backtesting: 'POST /api/pdm_backtest',
        portfolio_management: 'GET|POST /api/portfolio/:user_id'
      },
      features: [
        'Real-time stock price prediction',
        'Price-Volume Derivatives Momentum Strategy',
        'Batch processing capabilities',
        'Technical indicator analysis',
        'Sentiment analysis integration',
        'Portfolio management tools',
        'Alpha Vantage market data integration'
      ],
      rate_limits: {
        window_minutes: this.configuration.rate_limit_window_minutes,
        max_requests: this.configuration.rate_limit_max_requests
      }
    };

    response.status(200).json(api_documentation);
  }

  private async handle_stock_prediction(request: Request, response: Response): Promise<void> {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      response.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const prediction_request: StockPredictionRequest = request.body;
      const sanitized_ticker = prediction_request.ticker.toUpperCase().trim();
      const prediction_days = Math.min(Math.max(prediction_request.days || 1, 1), 30);
      const include_pdm_analysis = prediction_request.include_pdm !== false;

      logger.info(`Processing prediction request: ${sanitized_ticker} (${prediction_days} days, PDM: ${include_pdm_analysis})`);

      const ml_service_response = await axios.post(
        `${this.configuration.machinelearning_service_url}/predict`,
        {
          ticker: sanitized_ticker,
          days: prediction_days,
          include_pdm: include_pdm_analysis
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Roneira-AI-Backend/2.0.0'
          }
        }
      );

      sendSuccess(response, ml_service_response.data);
    } catch (error) {
      logger.error('Stock prediction error:', error);
      this.handle_ml_service_error(error as AxiosError, response);
    }
  }

  private async handle_batch_prediction(request: Request, response: Response): Promise<void> {
    try {
      const batch_request: BatchPredictionRequest = request.body;

      if (!batch_request.tickers || !Array.isArray(batch_request.tickers) || batch_request.tickers.length === 0) {
        response.status(400).json({
          success: false,
          error: 'Array of ticker symbols is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (batch_request.tickers.length > 10) {
        response.status(400).json({
          success: false,
          error: 'Maximum 10 ticker symbols allowed per batch request',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const sanitized_tickers = batch_request.tickers
        .map(ticker => ticker.toUpperCase().trim())
        .filter(ticker => ticker.length > 0);

      const ml_service_response = await axios.post(
        `${this.configuration.machinelearning_service_url}/batch_predict`,
        {
          tickers: sanitized_tickers,
          include_pdm: batch_request.include_pdm === true
        },
        {
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Roneira-AI-Backend/2.0.0'
          }
        }
      );

      response.status(200).json({
        success: true,
        data: ml_service_response.data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Batch prediction error:', error);
      this.handle_ml_service_error(error as AxiosError, response);
    }
  }

  private async handle_pdm_opportunity_scan(request: Request, response: Response): Promise<void> {
    try {
      const ml_service_response = await axios.get(
        `${this.configuration.machinelearning_service_url}/pdm_scan`,
        { timeout: 45000 }
      );

      response.status(200).json({
        success: true,
        data: ml_service_response.data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('PDM scan error:', error);
      this.handle_ml_service_error(error as AxiosError, response);
    }
  }

  private async handle_pdm_backtest(request: Request, response: Response): Promise<void> {
    try {
      const backtest_request: PDMBacktestRequest = request.body;
      const start_date = backtest_request.start_date || '2025-04-01';
      const end_date = backtest_request.end_date || '2025-10-01';

      const ml_service_response = await axios.post(
        `${this.configuration.machinelearning_service_url}/pdm_backtest`,
        { start_date, end_date },
        { timeout: 30000 }
      );

      response.status(200).json({
        success: true,
        data: ml_service_response.data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('PDM backtest error:', error);
      this.handle_ml_service_error(error as AxiosError, response);
    }
  }

  private handle_get_portfolio(request: Request, response: Response): void {
    response.status(200).json({
      success: true,
      message: 'Portfolio management feature coming soon',
      user_id: request.params.user_id,
      timestamp: new Date().toISOString()
    });
  }

  private handle_update_portfolio(request: Request, response: Response): void {
    response.status(200).json({
      success: true,
      message: 'Portfolio update feature coming soon',
      user_id: request.params.user_id,
      timestamp: new Date().toISOString()
    });
  }

  private handle_ml_service_error(error: AxiosError, response: Response): void {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      sendError(response, 'Machine Learning service is currently unavailable', 503);
    } else if (error.response) {
      const errorData = error.response.data as { error?: string };
      sendError(response, errorData?.error || 'ML service returned an error', error.response.status || 500);
    } else {
      sendError(response, 'An internal server error occurred', 500);
    }
  }

  private handle_not_found(request: Request, response: Response): void {
    sendError(response, 'API endpoint not found', 404);
  }

  private handle_server_error(error: Error, request: Request, response: Response, next: NextFunction): void {
    logger.error('Unhandled server error:', error);
    if (response.headersSent) {
      return next(error);
    }
    sendError(response, 'An internal server error occurred', 500);
  }

  private setup_graceful_shutdown(): void {
    const shutdown_handler = (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown_handler('SIGTERM'));
    process.on('SIGINT', () => shutdown_handler('SIGINT'));
  }

  public start_server(): void {
    this.setup_graceful_shutdown();

    this.application.listen(this.configuration.port, '0.0.0.0', () => {
      logger.info('====================================');
      logger.info('🚀 Roneira AI HIFI Backend Server');
      logger.info('====================================');
      logger.info(`📍 Port: ${this.configuration.port}`);
      logger.info(`🔗 ML Service: ${this.configuration.machinelearning_service_url}`);
      logger.info(`🌐 CORS Origins: ${this.configuration.cors_allowed_origins}`);
      logger.info(`🛡️  Environment: ${this.configuration.node_environment}`);
      logger.info(`⚡ Rate Limit: ${this.configuration.rate_limit_max_requests} requests per ${this.configuration.rate_limit_window_minutes} minutes`);
      logger.info(`✅ Server is ready and accepting connections`);
      logger.info(`📊 Health check: http://localhost:${this.configuration.port}/health`);
      logger.info('====================================');
    });
  }

  public get_application(): Application {
    return this.application;
  }
}

// Initialize and start server
if (require.main === module) {
  const backend_server = new BackendServer();
  backend_server.start_server();
}

export default BackendServer;