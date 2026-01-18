/**
 * Roneira AI HIFI - Database Service Layer
 *
 * Provides a type-safe interface to TimescaleDB for portfolio management,
 * historical stock data, and ML predictions. Uses connection pooling for
 * production-grade performance.
 *
 * @module services/databaseService
 */

import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import logger from '../utils/logger';

/**
 * Portfolio holding record
 */
export interface PortfolioHolding {
  id: string;
  portfolioId: string;
  ticker: string;
  shares: number;
  averageCost: number;
  purchaseDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Stock price record
 */
export interface StockPrice {
  time: Date;
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
  source: string;
}

/**
 * ML prediction record
 */
export interface PredictionRecord {
  id: string;
  ticker: string;
  predictionTime: Date;
  targetDate: Date;
  predictedPrice: number;
  actualPrice?: number;
  confidence: number;
  modelType: string;
  modelVersion?: string;
  pdmSignal?: string;
  featuresUsed?: Record<string, unknown>;
}

/**
 * Database connection status
 */
export interface DatabaseStatus {
  connected: boolean;
  poolSize: number;
  idleCount: number;
  waitingCount: number;
  totalConnections: number;
}

/**
 * Database Service Class
 *
 * Manages PostgreSQL/TimescaleDB connections and provides typed query methods
 * for all database operations.
 */
class DatabaseService {
  private pool: Pool | null = null;
  private connected = false;

  /**
   * Initialize database connection pool
   *
   * @param connectionString - PostgreSQL connection URL
   */
  async connect(connectionString?: string): Promise<void> {
    if (this.pool && this.connected) {
      logger.debug('Database already connected');
      return;
    }

    const config: PoolConfig = {
      connectionString: connectionString || process.env.DATABASE_URL,
      max: 20, // Maximum pool size
      min: 5, // Minimum pool size
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Connection attempt timeout
    };

    try {
      this.pool = new Pool(config);

      // Set up event handlers
      this.pool.on('error', (error: Error) => {
        logger.error('Unexpected database pool error:', error);
      });

      this.pool.on('connect', () => {
        logger.debug('New database connection established');
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.connected = true;
      logger.info('Database service connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      this.pool = null;
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connected = false;
      logger.info('Database service disconnected');
    }
  }

  /**
   * Get connection status
   */
  getStatus(): DatabaseStatus {
    if (!this.pool) {
      return {
        connected: false,
        poolSize: 0,
        idleCount: 0,
        waitingCount: 0,
        totalConnections: 0,
      };
    }

    return {
      connected: this.connected,
      poolSize: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      totalConnections: this.pool.totalCount,
    };
  }

  /**
   * Check if database is available
   */
  isAvailable(): boolean {
    return this.pool !== null && this.connected;
  }

  /**
   * Execute a query
   *
   * @param query - SQL query string
   * @param params - Query parameters
   */
  private async query<T extends QueryResultRow>(query: string, params?: unknown[]): Promise<QueryResult<T>> {
    if (!this.isAvailable()) {
      throw new Error('Database not connected');
    }

    const start = Date.now();
    try {
      const result = await this.pool!.query<T>(query, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        logger.warn(`Slow query detected (${duration}ms):`, query.substring(0, 100));
      }

      return result;
    } catch (error) {
      logger.error('Database query error:', { query: query.substring(0, 100), error });
      throw error;
    }
  }

  // =====================================================
  // PORTFOLIO OPERATIONS
  // =====================================================

  /**
   * Get all holdings for a portfolio
   *
   * @param portfolioId - Portfolio ID (defaults to 'default')
   */
  async getPortfolioHoldings(portfolioId: string = 'default'): Promise<PortfolioHolding[]> {
    const result = await this.query<PortfolioHolding>(
      `SELECT 
        id, portfolio_id as "portfolioId", ticker, shares,
        average_cost as "averageCost", purchase_date as "purchaseDate",
        notes, created_at as "createdAt", updated_at as "updatedAt"
       FROM portfolio.holdings
       WHERE portfolio_id = $1
       ORDER BY ticker`,
      [portfolioId]
    );

    return result.rows;
  }

  /**
   * Add or update a holding
   *
   * @param holding - Holding data
   */
  async upsertHolding(
    portfolioId: string,
    ticker: string,
    shares: number,
    averageCost: number,
    notes?: string
  ): Promise<PortfolioHolding> {
    const result = await this.query<PortfolioHolding>(
      `INSERT INTO portfolio.holdings 
        (portfolio_id, ticker, shares, average_cost, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (portfolio_id, ticker)
       DO UPDATE SET 
         shares = EXCLUDED.shares,
         average_cost = EXCLUDED.average_cost,
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING 
        id, portfolio_id as "portfolioId", ticker, shares,
        average_cost as "averageCost", purchase_date as "purchaseDate",
        notes, created_at as "createdAt", updated_at as "updatedAt"`,
      [portfolioId, ticker.toUpperCase(), shares, averageCost, notes]
    );

    return result.rows[0];
  }

  /**
   * Remove a holding
   *
   * @param portfolioId - Portfolio ID
   * @param ticker - Stock ticker
   */
  async removeHolding(portfolioId: string, ticker: string): Promise<boolean> {
    const result = await this.query(
      `DELETE FROM portfolio.holdings
       WHERE portfolio_id = $1 AND ticker = $2`,
      [portfolioId, ticker.toUpperCase()]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // =====================================================
  // STOCK PRICE HISTORY OPERATIONS
  // =====================================================

  /**
   * Store historical stock prices
   *
   * @param prices - Array of stock price records
   */
  async insertStockPrices(prices: StockPrice[]): Promise<number> {
    if (prices.length === 0) return 0;

    const values = prices
      .map(
        (p) =>
          `('${p.time.toISOString()}', '${p.ticker.toUpperCase()}', ${p.open}, ${p.high}, ${p.low}, ${p.close}, ${p.volume}, ${p.adjustedClose || 'NULL'}, '${p.source}')`
      )
      .join(',');

    const result = await this.query(
      `INSERT INTO market_data.stock_prices 
        (time, ticker, open, high, low, close, volume, adjusted_close, source)
       VALUES ${values}
       ON CONFLICT DO NOTHING`
    );

    return result.rowCount ?? 0;
  }

  /**
   * Get historical stock prices
   *
   * @param ticker - Stock ticker
   * @param startDate - Start date
   * @param endDate - End date
   */
  async getStockPrices(
    ticker: string,
    startDate: Date,
    endDate: Date
  ): Promise<StockPrice[]> {
    const result = await this.query<StockPrice>(
      `SELECT 
        time, ticker, open, high, low, close, volume,
        adjusted_close as "adjustedClose", source
       FROM market_data.stock_prices
       WHERE ticker = $1 AND time BETWEEN $2 AND $3
       ORDER BY time DESC`,
      [ticker.toUpperCase(), startDate.toISOString(), endDate.toISOString()]
    );

    return result.rows;
  }

  /**
   * Get latest stock price
   *
   * @param ticker - Stock ticker
   */
  async getLatestPrice(ticker: string): Promise<StockPrice | null> {
    const result = await this.query<StockPrice>(
      `SELECT 
        time, ticker, open, high, low, close, volume,
        adjusted_close as "adjustedClose", source
       FROM market_data.stock_prices
       WHERE ticker = $1
       ORDER BY time DESC
       LIMIT 1`,
      [ticker.toUpperCase()]
    );

    return result.rows[0] || null;
  }

  // =====================================================
  // PREDICTION HISTORY OPERATIONS
  // =====================================================

  /**
   * Store a prediction record
   *
   * @param prediction - Prediction data
   */
  async insertPrediction(prediction: Omit<PredictionRecord, 'id'>): Promise<PredictionRecord> {
    const result = await this.query<PredictionRecord>(
      `INSERT INTO ml_predictions.predictions 
        (ticker, prediction_time, target_date, predicted_price, confidence,
         model_type, model_version, pdm_signal, features_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING 
        id, ticker, prediction_time as "predictionTime",
        target_date as "targetDate", predicted_price as "predictedPrice",
        actual_price as "actualPrice", confidence, model_type as "modelType",
        model_version as "modelVersion", pdm_signal as "pdmSignal",
        features_used as "featuresUsed"`,
      [
        prediction.ticker.toUpperCase(),
        prediction.predictionTime.toISOString(),
        prediction.targetDate.toISOString(),
        prediction.predictedPrice,
        prediction.confidence,
        prediction.modelType,
        prediction.modelVersion,
        prediction.pdmSignal,
        JSON.stringify(prediction.featuresUsed || {}),
      ]
    );

    return result.rows[0];
  }

  /**
   * Get prediction history for backtesting
   *
   * @param ticker - Stock ticker
   * @param limit - Maximum records to return
   */
  async getPredictionHistory(ticker: string, limit: number = 100): Promise<PredictionRecord[]> {
    const result = await this.query<PredictionRecord>(
      `SELECT 
        id, ticker, prediction_time as "predictionTime",
        target_date as "targetDate", predicted_price as "predictedPrice",
        actual_price as "actualPrice", confidence, model_type as "modelType",
        model_version as "modelVersion", pdm_signal as "pdmSignal",
        features_used as "featuresUsed"
       FROM ml_predictions.predictions
       WHERE ticker = $1
       ORDER BY prediction_time DESC
       LIMIT $2`,
      [ticker.toUpperCase(), limit]
    );

    return result.rows;
  }

  /**
   * Update prediction with actual price (for accuracy tracking)
   *
   * @param predictionId - Prediction ID
   * @param actualPrice - Actual observed price
   */
  async updatePredictionActual(predictionId: string, actualPrice: number): Promise<boolean> {
    const result = await this.query(
      `UPDATE ml_predictions.predictions
       SET actual_price = $2
       WHERE id = $1`,
      [predictionId, actualPrice]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // =====================================================
  // HEALTH CHECK
  // =====================================================

  /**
   * Health check query
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health');
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const database = new DatabaseService();
export default database;
