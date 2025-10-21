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
import axios, { AxiosError } from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

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
    this.port = parseInt(process.env.PORT || '5000', 10);
    this.machinelearning_service_url = process.env.ML_SERVICE_URL || 'http://localhost:5000';
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
    // Security middleware
    this.application.use(helmet());
    
    // Compression middleware
    this.application.use(compression());
    
    // Logging middleware
    if (this.configuration.node_environment !== 'test') {
      this.application.use(morgan('combined'));
    }
    
    // CORS configuration
    this.application.use(cors({
      origin: this.configuration.cors_allowed_origins.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));
    
    // Rate limiting
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
    
    // Body parsing middleware
    this.application.use(express.json({ limit: '10mb' }));
    this.application.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }
  
  private initialize_routes(): void {
    // Health check endpoint
    this.application.get('/health', this.handle_health_check.bind(this));
    
    // API information endpoint
    this.application.get('/api', this.handle_api_information.bind(this));
    
    // Stock prediction endpoints
    this.application.post('/api/predict', this.handle_stock_prediction.bind(this));
    this.application.post('/api/batch_predict', this.handle_batch_prediction.bind(this));
    
    // PDM strategy endpoints
    this.application.get('/api/pdm_scan', this.handle_pdm_opportunity_scan.bind(this));
    this.application.post('/api/pdm_backtest', this.handle_pdm_backtest.bind(this));
    
    // Portfolio management endpoints (placeholder for future implementation)
    this.application.get('/api/portfolio/:user_id', this.handle_get_portfolio.bind(this));
    this.application.post('/api/portfolio/:user_id/update', this.handle_update_portfolio.bind(this));
  }
  
  private initialize_error_handlers(): void {
    // 404 handler
    this.application.use(this.handle_not_found.bind(this));
    
    // General error handler
    this.application.use(this.handle_server_error.bind(this));
  }
  
  private async handle_health_check(request: Request, response: Response): Promise<void> {
    try {
      // Check ML service health
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
      
      response.status(200).json(health_status);
    } catch (error) {
      console.error('Health check error:', error);
      response.status(500).json({
        service_status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  }
  
  private handle_api_information(request: Request, response: Response): void {
    const api_documentation = {
      service_name: 'Roneira AI HIFI Backend API',
      version: '2.0.0',
      description: 'Advanced financial intelligence platform with PDM strategy integration',
      endpoints: {
        health_check: 'GET /health',
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
        'Portfolio management tools'
      ],
      rate_limits: {
        window_minutes: this.configuration.rate_limit_window_minutes,
        max_requests: this.configuration.rate_limit_max_requests
      }
    };
    
    response.status(200).json(api_documentation);
  }
  
  private async handle_stock_prediction(request: Request, response: Response): Promise<void> {
    try {
      const prediction_request: StockPredictionRequest = request.body;
      
      // Validate request
      if (!prediction_request.ticker) {
        response.status(400).json({
          success: false,
          error: 'Stock ticker symbol is required',
          example_request: {
            ticker: 'AAPL',
            days: 1,
            include_pdm: true
          },
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Sanitize and prepare request
      const sanitized_ticker = prediction_request.ticker.toUpperCase().trim();
      const prediction_days = Math.min(Math.max(prediction_request.days || 1, 1), 30); // Limit 1-30 days
      const include_pdm_analysis = prediction_request.include_pdm !== false; // Default to true
      
      console.log(`Processing prediction request: ${sanitized_ticker} (${prediction_days} days, PDM: ${include_pdm_analysis})`);
      
      // Forward request to ML service
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
      
      const prediction_result: APIResponse = {
        success: true,
        data: ml_service_response.data,
        timestamp: new Date().toISOString()
      };
      
      response.status(200).json(prediction_result);
      
    } catch (error) {
      console.error('Stock prediction error:', error);
      this.handle_ml_service_error(error as AxiosError, response);
    }
  }
  
  private async handle_batch_prediction(request: Request, response: Response): Promise<void> {
    try {
      const batch_request: BatchPredictionRequest = request.body;
      
      // Validate request
      if (!batch_request.tickers || !Array.isArray(batch_request.tickers) || batch_request.tickers.length === 0) {
        response.status(400).json({
          success: false,
          error: 'Array of ticker symbols is required',
          example_request: {
            tickers: ['AAPL', 'GOOGL', 'MSFT'],
            include_pdm: false
          },
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      if (batch_request.tickers.length > 10) {
        response.status(400).json({
          success: false,
          error: 'Maximum 10 ticker symbols allowed per batch request',
          provided_count: batch_request.tickers.length,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Sanitize tickers
      const sanitized_tickers = batch_request.tickers
        .map(ticker => ticker.toUpperCase().trim())
        .filter(ticker => ticker.length > 0);
      
      const include_pdm_analysis = batch_request.include_pdm === true;
      
      console.log(`Processing batch prediction for ${sanitized_tickers.length} tickers (PDM: ${include_pdm_analysis})`);
      
      // Forward request to ML service
      const ml_service_response = await axios.post(
        `${this.configuration.machinelearning_service_url}/batch_predict`,
        {
          tickers: sanitized_tickers,
          include_pdm: include_pdm_analysis
        },
        {
          timeout: 60000, // Longer timeout for batch processing
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Roneira-AI-Backend/2.0.0'
          }
        }
      );
      
      const batch_result: APIResponse = {
        success: true,
        data: ml_service_response.data,
        timestamp: new Date().toISOString()
      };
      
      response.status(200).json(batch_result);
      
    } catch (error) {
      console.error('Batch prediction error:', error);
      this.handle_ml_service_error(error as AxiosError, response);
    }
  }
  
  private async handle_pdm_opportunity_scan(request: Request, response: Response): Promise<void> {
    try {
      console.log('Processing PDM opportunity scan request');
      
      const ml_service_response = await axios.get(
        `${this.configuration.machinelearning_service_url}/pdm_scan`,
        {
          timeout: 45000,
          headers: {
            'User-Agent': 'Roneira-AI-Backend/2.0.0'
          }
        }
      );
      
      const scan_result: APIResponse = {
        success: true,
        data: ml_service_response.data,
        timestamp: new Date().toISOString()
      };
      
      response.status(200).json(scan_result);
      
    } catch (error) {
      console.error('PDM scan error:', error);
      this.handle_ml_service_error(error as AxiosError, response);
    }
  }
  
  private async handle_pdm_backtest(request: Request, response: Response): Promise<void> {
    try {
      const backtest_request: PDMBacktestRequest = request.body;
      
      // Set default dates if not provided
      const start_date = backtest_request.start_date || '2025-04-01';
      const end_date = backtest_request.end_date || '2025-10-01';
      
      console.log(`Processing PDM backtest: ${start_date} to ${end_date}`);
      
      const ml_service_response = await axios.post(
        `${this.configuration.machinelearning_service_url}/pdm_backtest`,
        {
          start_date: start_date,
          end_date: end_date
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Roneira-AI-Backend/2.0.0'
          }
        }
      );
      
      const backtest_result: APIResponse = {
        success: true,
        data: ml_service_response.data,
        timestamp: new Date().toISOString()
      };
      
      response.status(200).json(backtest_result);
      
    } catch (error) {
      console.error('PDM backtest error:', error);
      this.handle_ml_service_error(error as AxiosError, response);
    }
  }
  
  // Placeholder for portfolio management endpoints
  private handle_get_portfolio(request: Request, response: Response): void {
    const user_id = request.params.user_id;
    
    response.status(200).json({
      success: true,
      message: 'Portfolio management feature coming soon',
      user_id: user_id,
      endpoints: {
        get_portfolio: `GET /api/portfolio/${user_id}`,
        update_portfolio: `POST /api/portfolio/${user_id}/update`
      },
      timestamp: new Date().toISOString()
    });
  }
  
  private handle_update_portfolio(request: Request, response: Response): void {
    const user_id = request.params.user_id;
    
    response.status(200).json({
      success: true,
      message: 'Portfolio update feature coming soon',
      user_id: user_id,
      request_data: request.body,
      timestamp: new Date().toISOString()
    });
  }
  
  private handle_ml_service_error(error: AxiosError, response: Response): void {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      response.status(503).json({
        success: false,
        error: 'Machine Learning service is currently unavailable. Please try again later.',
        service_url: this.configuration.machinelearning_service_url,
        timestamp: new Date().toISOString()
      });
    } else if (error.response) {
      response.status(error.response.status || 500).json({
        success: false,
        error: error.response.data?.error || 'ML service returned an error',
        details: error.response.data,
        timestamp: new Date().toISOString()
      });
    } else {
      response.status(500).json({
        success: false,
        error: 'An internal server error occurred while communicating with the ML service',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  private handle_not_found(request: Request, response: Response): void {
    response.status(404).json({
      success: false,
      error: 'API endpoint not found',
      requested_path: request.path,
      method: request.method,
      available_endpoints: {
        health_check: 'GET /health',
        api_documentation: 'GET /api',
        stock_prediction: 'POST /api/predict',
        batch_prediction: 'POST /api/batch_predict',
        pdm_opportunity_scan: 'GET /api/pdm_scan',
        pdm_backtesting: 'POST /api/pdm_backtest'
      },
      timestamp: new Date().toISOString()
    });
  }
  
  private handle_server_error(error: Error, request: Request, response: Response, next: NextFunction): void {
    console.error('Unhandled server error:', error);
    
    if (response.headersSent) {
      return next(error);
    }
    
    response.status(500).json({
      success: false,
      error: 'An internal server error occurred',
      timestamp: new Date().toISOString(),
      ...(this.configuration.node_environment === 'development' && {
        debug: {
          message: error.message,
          stack: error.stack
        }
      })
    });
  }
  
  private setup_graceful_shutdown(): void {
    const shutdown_handler = (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      
      process.exit(0);
    };
    
    process.on('SIGTERM', () => shutdown_handler('SIGTERM'));
    process.on('SIGINT', () => shutdown_handler('SIGINT'));
  }
  
  public start_server(): void {
    this.setup_graceful_shutdown();
    
    this.application.listen(this.configuration.port, '0.0.0.0', () => {
      console.log('====================================');
      console.log('🚀 Roneira AI HIFI Backend Server');
      console.log('====================================');
      console.log(`📍 Port: ${this.configuration.port}`);
      console.log(`🔗 ML Service: ${this.configuration.machinelearning_service_url}`);
      console.log(`🌐 CORS Origins: ${this.configuration.cors_allowed_origins}`);
      console.log(`🛡️  Environment: ${this.configuration.node_environment}`);
      console.log(`⚡ Rate Limit: ${this.configuration.rate_limit_max_requests} requests per ${this.configuration.rate_limit_window_minutes} minutes`);
      console.log(`✅ Server is ready and accepting connections`);
      console.log(`📊 Health check: http://localhost:${this.configuration.port}/health`);
      console.log('====================================');
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