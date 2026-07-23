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
 * Portfolio holding record - mirrors public.portfolio_holdings (see
 * supabase/migrations/001_initial_schema.sql), scoped by user_id.
 */
export interface PortfolioHolding {
  id: string;
  userId: string;
  ticker: string;
  companyName: string;
  exchange: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate: Date | null;
  sector: string | null;
  tags: string[];
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
 * ML prediction record - mirrors public.prediction_history (see
 * supabase/migrations/002_prediction_history.sql).
 *
 * Note: confidence is on a 0-100 scale to match that table's
 * `confidence_score` CHECK constraint, not the 0-1 fraction used by some
 * ML-service responses - convert at the call site if needed.
 */
export interface PredictionRecord {
  id: string;
  userId?: string;
  ticker: string;
  timeframe: string;
  modelUsed: string;
  currentPriceAtPrediction: number;
  predictedPrice: number;
  actualPrice?: number;
  confidence: number;
  technicalSignal?: string;
  targetDate: Date;
  status: string;
  predictionPayload?: Record<string, unknown>;
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
   * Get all holdings for a user's portfolio
   *
   * @param userId - Owning user's UUID
   */
  async getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]> {
    const result = await this.query<PortfolioHolding>(
      `SELECT
        id, user_id as "userId", ticker, company_name as "companyName",
        exchange, quantity, avg_buy_price as "avgBuyPrice", buy_date as "buyDate",
        sector, tags, created_at as "createdAt", updated_at as "updatedAt"
       FROM public.portfolio_holdings
       WHERE user_id = $1
       ORDER BY ticker`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Buy into a position: adds `additionalShares` at `purchasePrice`,
   * recomputing the weighted-average cost basis. Atomic and race-free - the
   * weighted average is computed by Postgres inside a single
   * INSERT ... ON CONFLICT DO UPDATE statement (which takes a row lock for
   * the duration of the statement), rather than a read-then-write from the
   * application, so two concurrent buys for the same (user, ticker) can
   * never clobber each other. Relies on the
   * portfolio_holdings_user_ticker_unique constraint (see
   * supabase/migrations/005_portfolio_holdings_unique_constraint.sql).
   */
  async addToHolding(
    userId: string,
    ticker: string,
    companyName: string,
    exchange: string,
    additionalShares: number,
    purchasePrice: number
  ): Promise<PortfolioHolding> {
    const result = await this.query<PortfolioHolding>(
      `INSERT INTO public.portfolio_holdings
        (user_id, ticker, company_name, exchange, quantity, avg_buy_price)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, ticker)
       DO UPDATE SET
         quantity = public.portfolio_holdings.quantity + EXCLUDED.quantity,
         avg_buy_price = (
           public.portfolio_holdings.quantity * public.portfolio_holdings.avg_buy_price
           + EXCLUDED.quantity * EXCLUDED.avg_buy_price
         ) / (public.portfolio_holdings.quantity + EXCLUDED.quantity),
         company_name = EXCLUDED.company_name,
         exchange = EXCLUDED.exchange,
         updated_at = NOW()
       RETURNING
        id, user_id as "userId", ticker, company_name as "companyName",
        exchange, quantity, avg_buy_price as "avgBuyPrice", buy_date as "buyDate",
        sector, tags, created_at as "createdAt", updated_at as "updatedAt"`,
      [userId, ticker.toUpperCase(), companyName, exchange, additionalShares, purchasePrice]
    );

    return result.rows[0];
  }

  /**
   * Remove a holding
   *
   * @param userId - Owning user's UUID
   * @param ticker - Stock ticker
   */
  async removeHolding(userId: string, ticker: string): Promise<boolean> {
    const result = await this.query(
      `DELETE FROM public.portfolio_holdings
       WHERE user_id = $1 AND ticker = $2`,
      [userId, ticker.toUpperCase()]
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
  async insertPrediction(prediction: Omit<PredictionRecord, 'id' | 'status'>): Promise<PredictionRecord> {
    const result = await this.query<PredictionRecord>(
      `INSERT INTO public.prediction_history
        (user_id, ticker, timeframe, model_used, current_price_at_prediction,
         predicted_price, confidence_score, technical_signal, target_date, prediction_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING
        id, user_id as "userId", ticker, timeframe, model_used as "modelUsed",
        current_price_at_prediction as "currentPriceAtPrediction",
        predicted_price as "predictedPrice", actual_price as "actualPrice",
        confidence_score as "confidence", technical_signal as "technicalSignal",
        target_date as "targetDate", status,
        prediction_payload as "predictionPayload"`,
      [
        prediction.userId || null,
        prediction.ticker.toUpperCase(),
        prediction.timeframe,
        prediction.modelUsed,
        prediction.currentPriceAtPrediction,
        prediction.predictedPrice,
        prediction.confidence,
        prediction.technicalSignal || null,
        prediction.targetDate.toISOString(),
        JSON.stringify(prediction.predictionPayload || {}),
      ]
    );

    return result.rows[0];
  }

  /**
   * Get prediction history for backtesting/accuracy tracking
   *
   * @param ticker - Stock ticker
   * @param limit - Maximum records to return
   */
  async getPredictionHistory(ticker: string, limit: number = 100): Promise<PredictionRecord[]> {
    const result = await this.query<PredictionRecord>(
      `SELECT
        id, user_id as "userId", ticker, timeframe, model_used as "modelUsed",
        current_price_at_prediction as "currentPriceAtPrediction",
        predicted_price as "predictedPrice", actual_price as "actualPrice",
        confidence_score as "confidence", technical_signal as "technicalSignal",
        target_date as "targetDate", status,
        prediction_payload as "predictionPayload"
       FROM public.prediction_history
       WHERE ticker = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [ticker.toUpperCase(), limit]
    );

    return result.rows;
  }

  /**
   * Resolve a prediction with its actual observed price (for accuracy tracking)
   *
   * @param predictionId - Prediction ID
   * @param actualPrice - Actual observed price
   */
  async updatePredictionActual(predictionId: string, actualPrice: number): Promise<boolean> {
    const result = await this.query(
      `UPDATE public.prediction_history
       SET actual_price = $2, status = 'resolved', resolved_at = NOW()
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
