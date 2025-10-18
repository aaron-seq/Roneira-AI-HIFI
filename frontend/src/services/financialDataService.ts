/**
 * Financial Data Service - API Communication Layer
 * 
 * Handles all communication with the backend API for financial data,
 * predictions, and PDM strategy analysis
 * 
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  StockPredictionResult,
  PDMOpportunity,
  MarketHealthStatus,
} from '../App';

interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

interface BatchPredictionResponse {
  batch_timestamp: string;
  total_predictions: number;
  predictions: StockPredictionResult[];
}

interface PDMScanResponse {
  scan_timestamp: string;
  opportunities_found: number;
  pdm_signals: PDMOpportunity[];
  strategy_info: {
    name: string;
    methodology: string;
    max_positions: number;
    min_liquidity_threshold: number;
  };
}

export class FinancialDataService {
  private apiClient: AxiosInstance;
  private readonly baseURL: string;
  
  constructor(baseURL: string) {
    this.baseURL = baseURL;
    
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    this.apiClient.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );
    
    this.apiClient.interceptors.response.use(
      (response) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error: AxiosError) => {
        this.handleAPIError(error);
        return Promise.reject(error);
      }
    );
  }
  
  private handleAPIError(error: AxiosError): void {
    const errorMessage = error.response?.data || error.message || 'Unknown API error';
    console.error('API Error:', {
      status: error.response?.status,
      message: errorMessage,
      url: error.config?.url,
      method: error.config?.method,
    });
  }
  
  async checkSystemHealth(): Promise<MarketHealthStatus> {
    try {
      const response = await this.apiClient.get<MarketHealthStatus>('/health');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to check system health: ${error}`);
    }
  }
  
  async getStockPrediction(
    tickerSymbol: string,
    predictionDays: number = 1,
    includePDMAnalysis: boolean = true
  ): Promise<StockPredictionResult> {
    try {
      const response = await this.apiClient.post<APIResponse<StockPredictionResult>>('/api/predict', {
        ticker: tickerSymbol.toUpperCase(),
        days: predictionDays,
        include_pdm: includePDMAnalysis,
      });
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Prediction request failed');
      }
      
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const apiError = error.response.data?.error || error.message;
        throw new Error(`Prediction failed for ${tickerSymbol}: ${apiError}`);
      }
      throw new Error(`Network error while fetching prediction for ${tickerSymbol}`);
    }
  }
  
  async scanPDMOpportunities(): Promise<PDMScanResponse> {
    try {
      const response = await this.apiClient.get<APIResponse<PDMScanResponse>>('/api/pdm_scan');
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'PDM scan request failed');
      }
      
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const apiError = error.response.data?.error || error.message;
        throw new Error(`PDM scan failed: ${apiError}`);
      }
      throw new Error('Network error during PDM opportunity scan');
    }
  }
  
  async executePDMBacktest(
    startDate: string,
    endDate: string
  ): Promise<any> {
    try {
      const response = await this.apiClient.post('/api/pdm_backtest', {
        start_date: startDate,
        end_date: endDate,
      });
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'PDM backtest request failed');
      }
      
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const apiError = error.response.data?.error || error.message;
        throw new Error(`PDM backtest failed: ${apiError}`);
      }
      throw new Error('Network error during PDM backtest execution');
    }
  }
  
  async getPortfolioData(userId: string): Promise<any> {
    try {
      const response = await this.apiClient.get(`/api/portfolio/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch portfolio data: ${error}`);
    }
  }
  
  async searchStocks(query: string): Promise<any[]> {
    const mockResults = [
      { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
      { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
      { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ' },
      { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ' },
    ];
    
    return mockResults.filter(stock => 
      stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
      stock.name.toLowerCase().includes(query.toLowerCase())
    );
  }
}