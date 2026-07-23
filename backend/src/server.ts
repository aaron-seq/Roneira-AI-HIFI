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
import axios, { AxiosError, AxiosResponse } from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import marketRoutes from './routes/marketRoutes';
import logger from './utils/logger';
import { sendSuccess, sendError } from './utils/response';
import { validateTicker } from './data/validTickers';
import { withRetry } from './utils/retry';
import { createCircuitBreaker, ML_SERVICE_CIRCUIT_OPTIONS } from './services/circuitBreaker';
import {
  getCachedData,
  setCachedData,
  getWithStaleWhileRevalidate,
  invalidateByPrefix,
} from './services/cacheService';
import database from './services/databaseService';
import * as authService from './services/authService';
import { AuthError } from './services/authService';
import { requireAuth, requireSelfOrAdmin, requireAdmin } from './middleware/authMiddleware';

// Load environment variables
dotenv.config();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://ml-service:5000';
const ML_REQUEST_TIMEOUT_MS = 8000; // short client timeout; retry/circuit-breaker handle the rest
const LAST_KNOWN_GOOD_TTL_SECONDS = 24 * 60 * 60; // fallback cache survives well past normal TTL

// Tickers whose predictions move fast enough to warrant a shorter cache TTL
const VOLATILE_TICKERS = new Set(['TSLA', 'NVDA', 'GME', 'AMD', 'META']);
const PREDICTION_TTL_DEFAULT_SECONDS = 180;
const PREDICTION_TTL_VOLATILE_SECONDS = 60;

// =====================================================
// ML SERVICE CALLS - retry with exponential backoff, wrapped in a circuit
// breaker so a degraded ML service stops receiving new requests until it
// recovers (issues #28 / #32).
// =====================================================

function mlServiceHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'Roneira-AI-Backend/2.0.0',
  };
}

const mlPredictBreaker = createCircuitBreaker<[Record<string, unknown>], AxiosResponse>(
  (payload) =>
    withRetry(
      () =>
        axios.post(`${ML_SERVICE_URL}/predict`, payload, {
          timeout: ML_REQUEST_TIMEOUT_MS,
          headers: mlServiceHeaders(),
        }),
      { name: 'ml-service:/predict', attempts: 3, baseDelayMs: 100 }
    ),
  undefined,
  { ...ML_SERVICE_CIRCUIT_OPTIONS, name: 'MLService-Predict' }
);

// Route paths match the canonical FastAPI service (ml-service/main.py):
// /predict, /predict/batch, /pdm/scan, /pdm/backtest. The service does not
// define the legacy underscore variants, so the proxy must use these.
const mlBatchPredictBreaker = createCircuitBreaker<[Record<string, unknown>], AxiosResponse>(
  (payload) =>
    withRetry(
      () =>
        axios.post(`${ML_SERVICE_URL}/predict/batch`, payload, {
          timeout: ML_REQUEST_TIMEOUT_MS * 2,
          headers: mlServiceHeaders(),
        }),
      { name: 'ml-service:/predict/batch', attempts: 3, baseDelayMs: 100 }
    ),
  undefined,
  { ...ML_SERVICE_CIRCUIT_OPTIONS, name: 'MLService-BatchPredict' }
);

const mlPdmScanBreaker = createCircuitBreaker<[], AxiosResponse>(
  () =>
    withRetry(() => axios.get(`${ML_SERVICE_URL}/pdm/scan`, { timeout: ML_REQUEST_TIMEOUT_MS * 3 }), {
      name: 'ml-service:/pdm/scan',
      attempts: 2,
      baseDelayMs: 200,
    }),
  undefined,
  { ...ML_SERVICE_CIRCUIT_OPTIONS, name: 'MLService-PdmScan' }
);

const mlPdmBacktestBreaker = createCircuitBreaker<[Record<string, unknown>], AxiosResponse>(
  (payload) =>
    withRetry(
      () =>
        axios.post(`${ML_SERVICE_URL}/pdm/backtest`, payload, { timeout: ML_REQUEST_TIMEOUT_MS * 3 }),
      { name: 'ml-service:/pdm/backtest', attempts: 2, baseDelayMs: 200 }
    ),
  undefined,
  { ...ML_SERVICE_CIRCUIT_OPTIONS, name: 'MLService-PdmBacktest' }
);

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

interface HealthCheckResponse {
  service_status: string;
  timestamp: string;
  environment: string;
  version: string;
  ml_service_status: string;
  database_status: 'connected' | 'disconnected';
  uptime_seconds: number;
}

// In-memory fallback portfolio record shape (legacy shape, used only when
// the database is unavailable)
interface InMemoryPosition {
  ticker: string;
  shares: number;
  avg_price: number;
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
    this.machinelearning_service_url = ML_SERVICE_URL;
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
      this.application.use(
        morgan('combined', {
          stream: {
            write: (message: string) => logger.info(message.trim()),
          },
        })
      );
    }

    this.application.use(
      cors({
        origin: this.configuration.cors_allowed_origins.split(','),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      })
    );

    const rate_limiter = rateLimit({
      windowMs: this.configuration.rate_limit_window_minutes * 60 * 1000,
      max: this.configuration.rate_limit_max_requests,
      message: {
        error: 'Too many requests from this IP address. Please try again later.',
        retry_after_minutes: this.configuration.rate_limit_window_minutes,
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.application.use('/api/', rate_limiter);
    this.application.use(express.json({ limit: '10mb' }));
    this.application.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  private initialize_routes(): void {
    this.application.get('/health', this.handle_health_check.bind(this));
    this.application.get('/api', this.handle_api_information.bind(this));

    // Handles /quote/:symbol, /timeseries/:symbol
    this.application.use('/api/market', marketRoutes); // Handles /overview, /movers

    // Stock prediction endpoints
    this.application.post(
      '/api/predict',
      body('ticker').isString().notEmpty(),
      this.handle_stock_prediction.bind(this)
    );

    this.application.post('/api/batch_predict', this.handle_batch_prediction.bind(this));
    this.application.get('/api/pdm_scan', this.handle_pdm_opportunity_scan.bind(this));
    this.application.get('/api/pdm/signals', this.handle_pdm_opportunity_scan.bind(this));
    this.application.post('/api/pdm_backtest', this.handle_pdm_backtest.bind(this));
    this.application.post('/api/pdm/backtest', this.handle_pdm_backtest.bind(this));

    this.application.get(
      '/api/portfolio/:user_id',
      requireAuth,
      requireSelfOrAdmin,
      this.handle_get_portfolio.bind(this)
    );
    this.application.post(
      '/api/portfolio/:user_id/update',
      requireAuth,
      requireSelfOrAdmin,
      this.handle_update_portfolio.bind(this)
    );

    this.application.post(
      '/api/cache/invalidate/:ticker',
      requireAuth,
      requireAdmin,
      this.handle_cache_invalidate.bind(this)
    );

    this.application.get('/api/news', this.handle_get_news.bind(this));

    // Auth endpoints get their own stricter rate limit (brute-force protection)
    const auth_rate_limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: { error: 'Too many authentication attempts. Please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.application.post(
      '/api/auth/login',
      auth_rate_limiter,
      this.handle_login.bind(this)
    );
    this.application.post(
      '/api/auth/register',
      auth_rate_limiter,
      this.handle_register.bind(this)
    );
  }

  private initialize_error_handlers(): void {
    this.application.use(this.handle_not_found.bind(this));
    this.application.use(this.handle_server_error.bind(this));
  }

  private async initialize_database(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      logger.warn(
        'DATABASE_URL not set - portfolio storage will use a non-persistent in-memory fallback. ' +
          'Data will be lost on restart. See backend/.env.example.'
      );
      return;
    }

    try {
      await database.connect();
    } catch (error) {
      logger.error(
        'Failed to connect to database - portfolio storage will use a non-persistent ' +
          'in-memory fallback until connectivity is restored.',
        error
      );
    }
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
        database_status: database.isAvailable() ? 'connected' : 'disconnected',
        uptime_seconds: uptime_seconds,
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
        portfolio_management: 'GET|POST /api/portfolio/:user_id (requires Authorization: Bearer <token>)',
        auth_login: 'POST /api/auth/login',
        auth_register: 'POST /api/auth/register',
        cache_invalidate: 'POST /api/cache/invalidate/:ticker (admin only)',
      },
      features: [
        'Real-time stock price prediction',
        'Price-Volume Derivatives Momentum Strategy',
        'Batch processing capabilities',
        'Technical indicator analysis',
        'Sentiment analysis integration',
        'Portfolio management tools',
        'Alpha Vantage market data integration',
      ],
      rate_limits: {
        window_minutes: this.configuration.rate_limit_window_minutes,
        max_requests: this.configuration.rate_limit_max_requests,
      },
    };

    response.status(200).json(api_documentation);
  }

  private async handle_stock_prediction(request: Request, response: Response): Promise<void> {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      response.status(400).json({ errors: errors.array() });
      return;
    }

    const prediction_request: StockPredictionRequest = request.body;
    const ticker_validation = validateTicker(prediction_request.ticker);

    if (!ticker_validation.valid) {
      logger.warn(`Rejected prediction request for invalid ticker: ${prediction_request.ticker}`);
      response.status(400).json({ success: false, error: ticker_validation.reason });
      return;
    }

    const sanitized_ticker = ticker_validation.normalized;
    const prediction_days = Math.min(Math.max(prediction_request.days || 1, 1), 30);
    const include_pdm_analysis = prediction_request.include_pdm !== false;

    // include_pdm changes the response shape (PDM/technical fields present or
    // not), so it must be part of the cache key - otherwise a cached
    // include_pdm=false response could be served to an include_pdm=true caller
    // and vice versa.
    const cache_key = `prediction:${sanitized_ticker}:${prediction_days}:pdm=${include_pdm_analysis}`;
    const last_known_good_key = `${cache_key}:last-known-good`;
    const ttl_seconds = VOLATILE_TICKERS.has(sanitized_ticker)
      ? PREDICTION_TTL_VOLATILE_SECONDS
      : PREDICTION_TTL_DEFAULT_SECONDS;

    logger.info(
      `Processing prediction request: ${sanitized_ticker} (${prediction_days} days, PDM: ${include_pdm_analysis})`
    );

    const fetch_fresh_prediction = async (): Promise<unknown> => {
      const ml_service_response = await mlPredictBreaker.fire({
        ticker: sanitized_ticker,
        days: prediction_days,
        include_pdm: include_pdm_analysis,
      });

      // Keep a long-lived copy for degraded-mode fallback, independent of
      // the short display TTL.
      await setCachedData(last_known_good_key, ml_service_response.data, LAST_KNOWN_GOOD_TTL_SECONDS);
      return ml_service_response.data;
    };

    try {
      const { value, stale } = await getWithStaleWhileRevalidate(cache_key, fetch_fresh_prediction, {
        ttlSeconds: ttl_seconds,
      });

      sendSuccess(response, { ...(value as object), stale, degraded: false });
    } catch (error) {
      logger.error('Stock prediction error:', error);

      const staleFallback = await getCachedData(last_known_good_key);
      if (staleFallback) {
        logger.warn(`ML service unavailable - serving last-known-good prediction for ${sanitized_ticker}`);
        sendSuccess(response, { ...(staleFallback as object), stale: true, degraded: true });
        return;
      }

      this.handle_ml_service_error(error as AxiosError, response);
    }
  }

  private async handle_batch_prediction(request: Request, response: Response): Promise<void> {
    try {
      const batch_request: BatchPredictionRequest = request.body;

      if (
        !batch_request.tickers ||
        !Array.isArray(batch_request.tickers) ||
        batch_request.tickers.length === 0
      ) {
        response.status(400).json({
          success: false,
          error: 'Array of ticker symbols is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (batch_request.tickers.length > 10) {
        response.status(400).json({
          success: false,
          error: 'Maximum 10 ticker symbols allowed per batch request',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const validations = batch_request.tickers.map((ticker) => validateTicker(ticker));
      const invalid = validations.find((v) => !v.valid);
      if (invalid) {
        logger.warn(`Rejected batch prediction - invalid ticker: ${invalid.normalized}`);
        response.status(400).json({
          success: false,
          error: invalid.reason,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const sanitized_tickers = validations.map((v) => v.normalized);

      const ml_service_response = await mlBatchPredictBreaker.fire({
        tickers: sanitized_tickers,
        include_pdm: batch_request.include_pdm === true,
      });

      response.status(200).json({
        success: true,
        data: ml_service_response.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Batch prediction error:', error);
      this.handle_ml_service_error(error as AxiosError, response);
    }
  }

  private async handle_pdm_opportunity_scan(request: Request, response: Response): Promise<void> {
    try {
      const ml_service_response = await mlPdmScanBreaker.fire();

      response.status(200).json({
        success: true,
        data: ml_service_response.data,
        timestamp: new Date().toISOString(),
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

      const ml_service_response = await mlPdmBacktestBreaker.fire({ start_date, end_date });

      response.status(200).json({
        success: true,
        data: ml_service_response.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('PDM backtest error:', error);
      this.handle_ml_service_error(error as AxiosError, response);
    }
  }

  // In-memory fallback storage - only used when the database is unavailable
  // (see initialize_database). Data does not survive a restart; this exists
  // purely so the API stays usable in a degraded state rather than failing
  // outright.
  private portfolio_storage: Record<string, InMemoryPosition[]> = {};

  private resolveExchange(ticker: string): string {
    if (ticker.endsWith('.NS')) return 'NSE';
    if (ticker.endsWith('.BO')) return 'BSE';
    return 'NASDAQ';
  }

  private async handle_get_portfolio(request: Request, response: Response): Promise<void> {
    const user_id = request.params.user_id;

    if (database.isAvailable()) {
      try {
        const holdings = await database.getPortfolioHoldings(user_id);
        sendSuccess(response, {
          data: holdings.map((h) => ({
            ticker: h.ticker,
            shares: Number(h.quantity),
            avg_price: Number(h.avgBuyPrice),
            company_name: h.companyName,
            exchange: h.exchange,
          })),
          persisted: true,
        });
        return;
      } catch (error) {
        logger.error('Failed to read portfolio from database:', error);
        sendError(response, 'Failed to load portfolio', 500);
        return;
      }
    }

    const portfolio = this.portfolio_storage[user_id] || [];
    response.status(200).json({
      success: true,
      data: portfolio,
      persisted: false,
      warning: 'Database unavailable: portfolio is held in memory only and will be lost on restart.',
      user_id: user_id,
      timestamp: new Date().toISOString(),
    });
  }

  private async handle_update_portfolio(request: Request, response: Response): Promise<void> {
    const user_id = request.params.user_id;
    const { ticker, shares, price, action, company_name, exchange } = request.body;

    const ticker_validation = validateTicker(ticker);
    if (!ticker_validation.valid) {
      sendError(response, ticker_validation.reason || 'Invalid ticker', 400);
      return;
    }
    const normalized_ticker = ticker_validation.normalized;

    if (action !== 'add' && action !== 'remove') {
      sendError(response, "action must be 'add' or 'remove'", 400);
      return;
    }

    if (action === 'add' && (typeof shares !== 'number' || shares <= 0 || typeof price !== 'number' || price < 0)) {
      sendError(response, 'shares must be a positive number and price must be non-negative', 400);
      return;
    }

    if (database.isAvailable()) {
      try {
        if (action === 'add') {
          await database.addToHolding(
            user_id,
            normalized_ticker,
            company_name || normalized_ticker,
            exchange || this.resolveExchange(normalized_ticker),
            shares,
            price
          );
        } else {
          await database.removeHolding(user_id, normalized_ticker);
        }

        const holdings = await database.getPortfolioHoldings(user_id);
        sendSuccess(response, {
          data: holdings.map((h) => ({
            ticker: h.ticker,
            shares: Number(h.quantity),
            avg_price: Number(h.avgBuyPrice),
            company_name: h.companyName,
            exchange: h.exchange,
          })),
          persisted: true,
          message: 'Portfolio updated successfully',
        });
      } catch (error) {
        logger.error('Failed to update portfolio in database:', error);
        sendError(response, 'Failed to update portfolio', 500);
      }
      return;
    }

    // Degraded mode: no database available, fall back to in-memory storage
    if (!this.portfolio_storage[user_id]) {
      this.portfolio_storage[user_id] = [];
    }

    const current_portfolio = this.portfolio_storage[user_id];
    const existing_position_index = current_portfolio.findIndex((p) => p.ticker === normalized_ticker);

    if (action === 'add') {
      if (existing_position_index >= 0) {
        const position = current_portfolio[existing_position_index];
        const new_total_shares = position.shares + shares;
        const new_avg_price =
          (position.shares * position.avg_price + shares * price) / new_total_shares;

        current_portfolio[existing_position_index] = {
          ticker: normalized_ticker,
          shares: new_total_shares,
          avg_price: new_avg_price,
        };
      } else {
        current_portfolio.push({ ticker: normalized_ticker, shares, avg_price: price });
      }
    } else if (existing_position_index >= 0) {
      current_portfolio.splice(existing_position_index, 1);
    }

    response.status(200).json({
      success: true,
      data: current_portfolio,
      persisted: false,
      warning: 'Database unavailable: portfolio is held in memory only and will be lost on restart.',
      message: 'Portfolio updated successfully',
      user_id: user_id,
      timestamp: new Date().toISOString(),
    });
  }

  private async handle_cache_invalidate(request: Request, response: Response): Promise<void> {
    const ticker_validation = validateTicker(request.params.ticker);
    if (!ticker_validation.valid) {
      sendError(response, ticker_validation.reason || 'Invalid ticker', 400);
      return;
    }

    const removed = await invalidateByPrefix(`prediction:${ticker_validation.normalized}`);
    logger.info(`Cache invalidated for ${ticker_validation.normalized} (${removed} entries removed)`);

    sendSuccess(response, { ticker: ticker_validation.normalized, entriesRemoved: removed });
  }

  private async handle_login(request: Request, response: Response): Promise<void> {
    try {
      const { username, password } = request.body;
      const result = await authService.login(username, password);
      sendSuccess(response, result);
    } catch (error) {
      if (error instanceof AuthError) {
        sendError(response, error.message, error.statusCode);
      } else {
        logger.error('Login error:', error);
        sendError(response, 'Authentication failed', 500);
      }
    }
  }

  private async handle_register(request: Request, response: Response): Promise<void> {
    try {
      const { username, password } = request.body;
      const result = await authService.register(username, password);
      sendSuccess(response, result, 201);
    } catch (error) {
      if (error instanceof AuthError) {
        sendError(response, error.message, error.statusCode);
      } else {
        logger.error('Registration error:', error);
        sendError(response, 'Registration failed', 500);
      }
    }
  }

  private handle_get_news(request: Request, response: Response): void {
    const news = [
      {
        id: 1,
        title: 'Market Rally Continues as Tech Stocks Surge',
        source: 'Financial Times',
        summary: 'Major indices hit new highs driven by AI sector growth.',
        url: '#',
        timestamp: new Date().toISOString(),
        sentiment: 'Positive',
      },
      {
        id: 2,
        title: 'Fed Signals Potential Rate Cuts Later This Year',
        source: 'Bloomberg',
        summary:
          'Federal Reserve officials hint at easing monetary policy if inflation data cooperates.',
        url: '#',
        timestamp: new Date().toISOString(),
        sentiment: 'Neutral',
      },
      {
        id: 3,
        title: 'Oil Prices Stabilize After Volatile Week',
        source: 'Reuters',
        summary: 'Global supply constraints balance with demand concerns.',
        url: '#',
        timestamp: new Date().toISOString(),
        sentiment: 'Neutral',
      },
      {
        id: 4,
        title: 'New Electric Vehicle Subsidy Program Announced',
        source: 'CNBC',
        summary: 'Government unveils new incentives for EV manufacturers and buyers.',
        url: '#',
        timestamp: new Date().toISOString(),
        sentiment: 'Positive',
      },
    ];

    sendSuccess(response, news);
  }

  private handle_ml_service_error(error: AxiosError, response: Response): void {
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNABORTED' ||
      error.code === 'EOPENBREAKER'
    ) {
      sendError(response, 'Machine Learning service is currently unavailable', 503);
    } else if (error.response) {
      sendError(
        response,
        'The ML service returned an error while processing the request',
        error.response.status || 500
      );
    } else {
      sendError(response, 'An internal server error occurred', 500);
    }
  }

  private handle_not_found(request: Request, response: Response): void {
    sendError(response, 'API endpoint not found', 404);
  }

  private handle_server_error(
    error: Error,
    request: Request,
    response: Response,
    next: NextFunction
  ): void {
    logger.error('Unhandled server error:', error);
    if (response.headersSent) {
      return next(error);
    }
    sendError(response, 'An internal server error occurred', 500);
  }

  private setup_graceful_shutdown(): void {
    const shutdown_handler = (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);
      database
        .disconnect()
        .catch((error) => logger.error('Error disconnecting database during shutdown:', error))
        .finally(() => process.exit(0));
    };

    process.on('SIGTERM', () => shutdown_handler('SIGTERM'));
    process.on('SIGINT', () => shutdown_handler('SIGINT'));
  }

  public start_server(): void {
    this.setup_graceful_shutdown();
    void this.initialize_database();

    this.application.listen(this.configuration.port, '0.0.0.0', () => {
      logger.info('====================================');
      logger.info('🚀 Roneira AI HIFI Backend Server');
      logger.info('====================================');
      logger.info(`📍 Port: ${this.configuration.port}`);
      logger.info(`🔗 ML Service: ${this.configuration.machinelearning_service_url}`);
      logger.info(`🌐 CORS Origins: ${this.configuration.cors_allowed_origins}`);
      logger.info(`🛡️  Environment: ${this.configuration.node_environment}`);
      logger.info(
        `⚡ Rate Limit: ${this.configuration.rate_limit_max_requests} requests per ${this.configuration.rate_limit_window_minutes} minutes`
      );
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
