/**
 * Roneira AI HIFI - Typed API Client
 *
 * Axios-based API client with Zod response validation for type-safe API calls.
 * Catches malformed data from the backend before it can crash the UI.
 *
 * @module services/apiClient
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import { z } from 'zod';
import {
  StockPredictionSchema,
  BatchPredictionSchema,
  PDMScanResponseSchema,
  PDMBacktestResultSchema,
  PortfolioSummarySchema,
  NewsFeedSchema,
  HealthCheckSchema,
  safeValidate,
  type StockPrediction,
  type BatchPrediction,
  type PDMScanResponse,
  type PDMBacktestResult,
  type PortfolioSummary,
  type NewsFeed,
  type HealthCheck,
} from '../schemas/apiSchemas';

// =====================================================
// CONFIGURATION
// =====================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const ML_API_BASE_URL = import.meta.env.VITE_ML_API_BASE_URL || 'http://localhost:5000';

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 30000;

/**
 * Maximum retries for failed requests
 */
const MAX_RETRIES = 2;

// =====================================================
// ERROR HANDLING
// =====================================================

/**
 * API error class with additional context
 */
export class ApiError extends Error {
  public readonly statusCode?: number;
  public readonly isNetworkError: boolean;
  public readonly isValidationError: boolean;
  public readonly originalError?: Error;
  public readonly validationErrors?: string[];

  constructor(
    message: string,
    options: {
      statusCode?: number;
      isNetworkError?: boolean;
      isValidationError?: boolean;
      originalError?: Error;
      validationErrors?: string[];
    } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = options.statusCode;
    this.isNetworkError = options.isNetworkError ?? false;
    this.isValidationError = options.isValidationError ?? false;
    this.originalError = options.originalError;
    this.validationErrors = options.validationErrors;
  }
}

/**
 * Transform Axios errors into ApiErrors
 */
function handleAxiosError(error: AxiosError): never {
  if (error.response) {
    // Server responded with an error status
    const message =
      (error.response.data as { message?: string })?.message ||
      `Request failed with status ${error.response.status}`;
    throw new ApiError(message, {
      statusCode: error.response.status,
      originalError: error,
    });
  } else if (error.request) {
    // Request was made but no response received
    throw new ApiError('Network error: Unable to reach the server', {
      isNetworkError: true,
      originalError: error,
    });
  } else {
    // Error setting up the request
    throw new ApiError(`Request setup error: ${error.message}`, {
      originalError: error,
    });
  }
}

// =====================================================
// API CLIENT CLASS
// =====================================================

/**
 * Typed API Client with Zod validation
 */
class TypedApiClient {
  private backendClient: AxiosInstance;
  private mlClient: AxiosInstance;

  constructor() {
    this.backendClient = this.createClient(API_BASE_URL);
    this.mlClient = this.createClient(ML_API_BASE_URL);
  }

  /**
   * Create Axios instance with default configuration
   */
  private createClient(baseURL: string): AxiosInstance {
    const client = axios.create({
      baseURL,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    client.interceptors.request.use(
      (config) => {
        console.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for logging
    client.interceptors.response.use(
      (response) => {
        console.debug(`[API] Response ${response.status} from ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`[API] Error from ${error.config?.url}:`, error.message);
        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * Make a validated GET request
   */
  private async validatedGet<T>(
    client: AxiosInstance,
    url: string,
    schema: z.ZodType<T>,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response: AxiosResponse = await client.get(url, config);
      const validation = safeValidate(schema, response.data);

      if (!validation.success) {
        console.error('[API] Response validation failed:', validation.errors);
        throw new ApiError('Invalid response format from server', {
          isValidationError: true,
          validationErrors: validation.errors,
        });
      }

      return validation.data!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (axios.isAxiosError(error)) handleAxiosError(error);
      throw error;
    }
  }

  /**
   * Make a validated POST request
   */
  private async validatedPost<T>(
    client: AxiosInstance,
    url: string,
    schema: z.ZodType<T>,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response: AxiosResponse = await client.post(url, data, config);
      const validation = safeValidate(schema, response.data);

      if (!validation.success) {
        console.error('[API] Response validation failed:', validation.errors);
        throw new ApiError('Invalid response format from server', {
          isValidationError: true,
          validationErrors: validation.errors,
        });
      }

      return validation.data!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (axios.isAxiosError(error)) handleAxiosError(error);
      throw error;
    }
  }

  // =====================================================
  // PREDICTION ENDPOINTS
  // =====================================================

  /**
   * Get stock prediction for a single ticker
   */
  async getPrediction(
    ticker: string,
    options?: { days?: number; includePdm?: boolean }
  ): Promise<StockPrediction> {
    const params = new URLSearchParams();
    if (options?.days) params.set('days', options.days.toString());
    if (options?.includePdm !== undefined) params.set('include_pdm', String(options.includePdm));

    return this.validatedGet(
      this.mlClient,
      `/predict/${ticker.toUpperCase()}?${params.toString()}`,
      StockPredictionSchema
    );
  }

  /**
   * Get batch predictions for multiple tickers
   */
  async getBatchPredictions(
    tickers: string[],
    options?: { includePdm?: boolean }
  ): Promise<BatchPrediction> {
    return this.validatedPost(
      this.mlClient,
      '/predict/batch',
      BatchPredictionSchema,
      {
        tickers: tickers.map((t) => t.toUpperCase()),
        include_pdm: options?.includePdm ?? true,
      }
    );
  }

  // =====================================================
  // PDM STRATEGY ENDPOINTS
  // =====================================================

  /**
   * Scan for PDM opportunities
   */
  async scanPdmOpportunities(): Promise<PDMScanResponse> {
    return this.validatedGet(this.mlClient, '/pdm/scan', PDMScanResponseSchema);
  }

  /**
   * Run PDM backtest
   */
  async runPdmBacktest(options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<PDMBacktestResult> {
    return this.validatedPost(
      this.mlClient,
      '/pdm/backtest',
      PDMBacktestResultSchema,
      options
    );
  }

  // =====================================================
  // PORTFOLIO ENDPOINTS
  // =====================================================

  /**
   * Get portfolio summary
   */
  async getPortfolio(): Promise<PortfolioSummary> {
    return this.validatedGet(
      this.backendClient,
      '/portfolio',
      PortfolioSummarySchema
    );
  }

  /**
   * Update portfolio holdings
   */
  async updatePortfolio(
    holdings: Array<{
      ticker: string;
      shares: number;
      avgCost: number;
      notes?: string;
    }>
  ): Promise<PortfolioSummary> {
    return this.validatedPost(
      this.backendClient,
      '/portfolio',
      PortfolioSummarySchema,
      { holdings }
    );
  }

  // =====================================================
  // NEWS ENDPOINTS
  // =====================================================

  /**
   * Get market news
   */
  async getNews(ticker?: string): Promise<NewsFeed> {
    const url = ticker ? `/news/${ticker.toUpperCase()}` : '/news';
    return this.validatedGet(this.backendClient, url, NewsFeedSchema);
  }

  // =====================================================
  // HEALTH ENDPOINTS
  // =====================================================

  /**
   * Check backend health
   */
  async checkBackendHealth(): Promise<HealthCheck> {
    return this.validatedGet(this.backendClient, '/health', HealthCheckSchema);
  }

  /**
   * Check ML service health
   */
  async checkMlHealth(): Promise<HealthCheck> {
    return this.validatedGet(this.mlClient, '/health', HealthCheckSchema);
  }

  // =====================================================
  // RAW API ACCESS (for endpoints without schemas)
  // =====================================================

  /**
   * Make a raw GET request without validation
   */
  async rawGet<T = unknown>(
    url: string,
    target: 'backend' | 'ml' = 'backend'
  ): Promise<T> {
    const client = target === 'backend' ? this.backendClient : this.mlClient;
    try {
      const response = await client.get<T>(url);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) handleAxiosError(error);
      throw error;
    }
  }

  /**
   * Make a raw POST request without validation
   */
  async rawPost<T = unknown>(
    url: string,
    data?: unknown,
    target: 'backend' | 'ml' = 'backend'
  ): Promise<T> {
    const client = target === 'backend' ? this.backendClient : this.mlClient;
    try {
      const response = await client.post<T>(url, data);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) handleAxiosError(error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiClient = new TypedApiClient();
export default apiClient;
