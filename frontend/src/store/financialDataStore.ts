/**
 * Financial Data Store - Zustand State Management
 * 
 * Centralized state management for financial data, predictions, and PDM strategy
 * 
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { StockPredictionResult, PDMOpportunity, MarketHealthStatus } from '../App';

interface PortfolioHolding {
  ticker_symbol: string;
  company_name: string;
  quantity: number;
  average_cost_basis: number;
  current_price: number;
  market_value: number;
  unrealized_gain_loss: number;
  unrealized_gain_loss_percentage: number;
  last_updated: string;
}

interface TechnicalIndicatorData {
  ticker_symbol: string;
  relative_strength_index: number;
  macd_line: number;
  macd_signal: number;
  bollinger_bands_upper: number;
  bollinger_bands_lower: number;
  simple_moving_average_20: number;
  simple_moving_average_50: number;
  volume_average_20: number;
  last_updated: string;
}

interface FinancialDataState {
  // Basic application state
  selectedStockTicker: string;
  isApplicationLoading: boolean;
  applicationErrorMessage: string | null;
  
  // Market and system health
  marketHealthStatus: MarketHealthStatus | null;
  
  // Stock prediction data
  currentPrediction: StockPredictionResult | null;
  predictionHistory: StockPredictionResult[];
  
  // PDM strategy data
  pdmOpportunities: PDMOpportunity[];
  pdmScanInProgress: boolean;
  lastPDMScanTimestamp: string | null;
  
  // Portfolio management
  portfolioHoldings: PortfolioHolding[];
  totalPortfolioValue: number;
  portfolioPerformancePercentage: number;
  
  // Technical analysis
  technicalIndicators: Record<string, TechnicalIndicatorData>;
  
  // Watchlist
  stockWatchlist: string[];
  
  // User preferences
  preferredDisplayCurrency: string;
  enableRealTimeUpdates: boolean;
  defaultPredictionHorizonDays: number;
  includePDMAnalysis: boolean;
}

interface FinancialDataActions {
  // Basic application actions
  setSelectedStockTicker: (ticker: string) => void;
  setIsApplicationLoading: (loading: boolean) => void;
  setApplicationErrorMessage: (error: string | null) => void;
  
  // Market health actions
  setMarketHealthStatus: (status: MarketHealthStatus | null) => void;
  
  // Stock prediction actions
  setCurrentPrediction: (prediction: StockPredictionResult | null) => void;
  addPredictionToHistory: (prediction: StockPredictionResult) => void;
  clearPredictionHistory: () => void;
  
  // PDM strategy actions
  setPDMOpportunities: (opportunities: PDMOpportunity[]) => void;
  setPDMScanInProgress: (scanning: boolean) => void;
  setLastPDMScanTimestamp: (timestamp: string) => void;
  addPDMOpportunity: (opportunity: PDMOpportunity) => void;
  removePDMOpportunity: (tickerSymbol: string) => void;
  
  // Portfolio management actions
  setPortfolioHoldings: (holdings: PortfolioHolding[]) => void;
  addPortfolioHolding: (holding: PortfolioHolding) => void;
  updatePortfolioHolding: (tickerSymbol: string, updates: Partial<PortfolioHolding>) => void;
  removePortfolioHolding: (tickerSymbol: string) => void;
  calculatePortfolioTotals: () => void;
  
  // Technical analysis actions
  setTechnicalIndicators: (tickerSymbol: string, indicators: TechnicalIndicatorData) => void;
  removeTechnicalIndicators: (tickerSymbol: string) => void;
  
  // Watchlist actions
  addToWatchlist: (tickerSymbol: string) => void;
  removeFromWatchlist: (tickerSymbol: string) => void;
  clearWatchlist: () => void;
  
  // User preference actions
  setPreferredDisplayCurrency: (currency: string) => void;
  setEnableRealTimeUpdates: (enabled: boolean) => void;
  setDefaultPredictionHorizonDays: (days: number) => void;
  setIncludePDMAnalysis: (include: boolean) => void;
  
  // Utility actions
  resetApplicationState: () => void;
  exportDataToJSON: () => string;
}

type FinancialDataStore = FinancialDataState & FinancialDataActions;

const initialState: FinancialDataState = {
  // Basic application state
  selectedStockTicker: 'AAPL',
  isApplicationLoading: false,
  applicationErrorMessage: null,
  
  // Market and system health
  marketHealthStatus: null,
  
  // Stock prediction data
  currentPrediction: null,
  predictionHistory: [],
  
  // PDM strategy data
  pdmOpportunities: [],
  pdmScanInProgress: false,
  lastPDMScanTimestamp: null,
  
  // Portfolio management
  portfolioHoldings: [],
  totalPortfolioValue: 0,
  portfolioPerformancePercentage: 0,
  
  // Technical analysis
  technicalIndicators: {},
  
  // Watchlist
  stockWatchlist: ['AAPL', 'GOOGL', 'MSFT', 'TSLA'],
  
  // User preferences
  preferredDisplayCurrency: 'USD',
  enableRealTimeUpdates: true,
  defaultPredictionHorizonDays: 1,
  includePDMAnalysis: true,
};

export const useFinancialDataStore = create<FinancialDataStore>()()
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        // Basic application actions
        setSelectedStockTicker: (ticker: string) => {
          set({ selectedStockTicker: ticker.toUpperCase() }, false, 'setSelectedStockTicker');
        },
        
        setIsApplicationLoading: (loading: boolean) => {
          set({ isApplicationLoading: loading }, false, 'setIsApplicationLoading');
        },
        
        setApplicationErrorMessage: (error: string | null) => {
          set({ applicationErrorMessage: error }, false, 'setApplicationErrorMessage');
        },
        
        // Market health actions
        setMarketHealthStatus: (status: MarketHealthStatus | null) => {
          set({ marketHealthStatus: status }, false, 'setMarketHealthStatus');
        },
        
        // Stock prediction actions
        setCurrentPrediction: (prediction: StockPredictionResult | null) => {
          set({ currentPrediction: prediction }, false, 'setCurrentPrediction');
        },
        
        addPredictionToHistory: (prediction: StockPredictionResult) => {
          const currentHistory = get().predictionHistory;
          const updatedHistory = [
            prediction,
            ...currentHistory.filter(p => p.ticker_symbol !== prediction.ticker_symbol)
          ].slice(0, 50); // Keep last 50 predictions
          
          set(
            {
              predictionHistory: updatedHistory,
              currentPrediction: prediction
            },
            false,
            'addPredictionToHistory'
          );
        },
        
        clearPredictionHistory: () => {
          set({ predictionHistory: [] }, false, 'clearPredictionHistory');
        },
        
        // PDM strategy actions
        setPDMOpportunities: (opportunities: PDMOpportunity[]) => {
          set({ pdmOpportunities: opportunities }, false, 'setPDMOpportunities');
        },
        
        setPDMScanInProgress: (scanning: boolean) => {
          set({ pdmScanInProgress: scanning }, false, 'setPDMScanInProgress');
        },
        
        setLastPDMScanTimestamp: (timestamp: string) => {
          set({ lastPDMScanTimestamp: timestamp }, false, 'setLastPDMScanTimestamp');
        },
        
        addPDMOpportunity: (opportunity: PDMOpportunity) => {
          const currentOpportunities = get().pdmOpportunities;
          const updatedOpportunities = [
            opportunity,
            ...currentOpportunities.filter(op => op.ticker_symbol !== opportunity.ticker_symbol)
          ];
          
          set({ pdmOpportunities: updatedOpportunities }, false, 'addPDMOpportunity');
        },
        
        removePDMOpportunity: (tickerSymbol: string) => {
          const currentOpportunities = get().pdmOpportunities;
          const filteredOpportunities = currentOpportunities.filter(
            op => op.ticker_symbol !== tickerSymbol
          );
          
          set({ pdmOpportunities: filteredOpportunities }, false, 'removePDMOpportunity');
        },
        
        // Portfolio management actions
        setPortfolioHoldings: (holdings: PortfolioHolding[]) => {
          set({ portfolioHoldings: holdings }, false, 'setPortfolioHoldings');
          get().calculatePortfolioTotals();
        },
        
        addPortfolioHolding: (holding: PortfolioHolding) => {
          const currentHoldings = get().portfolioHoldings;
          const existingIndex = currentHoldings.findIndex(
            h => h.ticker_symbol === holding.ticker_symbol
          );
          
          let updatedHoldings: PortfolioHolding[];
          
          if (existingIndex >= 0) {
            // Update existing holding
            updatedHoldings = [...currentHoldings];
            updatedHoldings[existingIndex] = holding;
          } else {
            // Add new holding
            updatedHoldings = [...currentHoldings, holding];
          }
          
          set({ portfolioHoldings: updatedHoldings }, false, 'addPortfolioHolding');
          get().calculatePortfolioTotals();
        },
        
        updatePortfolioHolding: (tickerSymbol: string, updates: Partial<PortfolioHolding>) => {
          const currentHoldings = get().portfolioHoldings;
          const updatedHoldings = currentHoldings.map(holding => 
            holding.ticker_symbol === tickerSymbol 
              ? { ...holding, ...updates, last_updated: new Date().toISOString() }
              : holding
          );
          
          set({ portfolioHoldings: updatedHoldings }, false, 'updatePortfolioHolding');
          get().calculatePortfolioTotals();
        },
        
        removePortfolioHolding: (tickerSymbol: string) => {
          const currentHoldings = get().portfolioHoldings;
          const filteredHoldings = currentHoldings.filter(
            holding => holding.ticker_symbol !== tickerSymbol
          );
          
          set({ portfolioHoldings: filteredHoldings }, false, 'removePortfolioHolding');
          get().calculatePortfolioTotals();
        },
        
        calculatePortfolioTotals: () => {
          const holdings = get().portfolioHoldings;
          const totalValue = holdings.reduce((sum, holding) => sum + holding.market_value, 0);
          const totalCost = holdings.reduce((sum, holding) => sum + (holding.quantity * holding.average_cost_basis), 0);
          const performancePercentage = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
          
          set({
            totalPortfolioValue: totalValue,
            portfolioPerformancePercentage: performancePercentage
          }, false, 'calculatePortfolioTotals');
        },
        
        // Technical analysis actions
        setTechnicalIndicators: (tickerSymbol: string, indicators: TechnicalIndicatorData) => {
          const currentIndicators = get().technicalIndicators;
          const updatedIndicators = {
            ...currentIndicators,
            [tickerSymbol]: indicators
          };
          
          set({ technicalIndicators: updatedIndicators }, false, 'setTechnicalIndicators');
        },
        
        removeTechnicalIndicators: (tickerSymbol: string) => {
          const currentIndicators = get().technicalIndicators;
          const { [tickerSymbol]: removed, ...remainingIndicators } = currentIndicators;
          
          set({ technicalIndicators: remainingIndicators }, false, 'removeTechnicalIndicators');
        },
        
        // Watchlist actions
        addToWatchlist: (tickerSymbol: string) => {
          const currentWatchlist = get().stockWatchlist;
          if (!currentWatchlist.includes(tickerSymbol.toUpperCase())) {
            const updatedWatchlist = [...currentWatchlist, tickerSymbol.toUpperCase()];
            set({ stockWatchlist: updatedWatchlist }, false, 'addToWatchlist');
          }
        },
        
        removeFromWatchlist: (tickerSymbol: string) => {
          const currentWatchlist = get().stockWatchlist;
          const filteredWatchlist = currentWatchlist.filter(
            ticker => ticker !== tickerSymbol.toUpperCase()
          );
          
          set({ stockWatchlist: filteredWatchlist }, false, 'removeFromWatchlist');
        },
        
        clearWatchlist: () => {
          set({ stockWatchlist: [] }, false, 'clearWatchlist');
        },
        
        // User preference actions
        setPreferredDisplayCurrency: (currency: string) => {
          set({ preferredDisplayCurrency: currency }, false, 'setPreferredDisplayCurrency');
        },
        
        setEnableRealTimeUpdates: (enabled: boolean) => {
          set({ enableRealTimeUpdates: enabled }, false, 'setEnableRealTimeUpdates');
        },
        
        setDefaultPredictionHorizonDays: (days: number) => {
          set({ defaultPredictionHorizonDays: days }, false, 'setDefaultPredictionHorizonDays');
        },
        
        setIncludePDMAnalysis: (include: boolean) => {
          set({ includePDMAnalysis: include }, false, 'setIncludePDMAnalysis');
        },
        
        // Utility actions
        resetApplicationState: () => {
          set(initialState, false, 'resetApplicationState');
        },
        
        exportDataToJSON: () => {
          const state = get();
          return JSON.stringify({
            predictionHistory: state.predictionHistory,
            portfolioHoldings: state.portfolioHoldings,
            stockWatchlist: state.stockWatchlist,
            technicalIndicators: state.technicalIndicators,
            exportTimestamp: new Date().toISOString()
          }, null, 2);
        },
      }),
      {
        name: 'roneira-financial-data-store',
        partialize: (state) => ({
          // Persist only specific parts of the state
          stockWatchlist: state.stockWatchlist,
          preferredDisplayCurrency: state.preferredDisplayCurrency,
          enableRealTimeUpdates: state.enableRealTimeUpdates,
          defaultPredictionHorizonDays: state.defaultPredictionHorizonDays,
          includePDMAnalysis: state.includePDMAnalysis,
          portfolioHoldings: state.portfolioHoldings,
        }),
      }
    ),
    {
      name: 'financial-data-store',
    }
  )
);