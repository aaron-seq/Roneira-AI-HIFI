/**
 * Roneira AI HIFI - Enhanced Frontend Application
 *
 * Features:
 * - Stock price prediction with ML models
 * - PDM (Price-Volume Derivatives Momentum) strategy analysis
 * - Real-time market data visualization
 * - Portfolio management tools
 * - Technical indicators display
 *
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import React, { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Import our custom components
import { NavigationHeader } from "../../components/navigation/NavigationHeader";
import { StockPredictionDashboard } from "../../components/prediction/StockPredictionDashboard";
import { PDMStrategyDashboard } from "../../components/pdm/PDMStrategyDashboard";
import { PortfolioManagementDashboard } from "../../components/portfolio/PortfolioManagementDashboard";
import { TechnicalAnalysisDashboard } from "../../components/analysis/TechnicalAnalysisDashboard";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { ErrorBoundary } from "../../components/ui/ErrorBoundary";
import { MarketOverviewDashboard } from "../../components/overview/MarketOverviewDashboard";
// Import utilities and types
import { useFinancialDataStore } from "../../store/financialDataStore";
import { ApplicationConfiguration } from "../../config/applicationConfig";
import { fetchMarketOverview } from "../../services/financialDataService";
import { NotificationService } from "../../services/notificationService";

// Type definitions for better type safety
export interface StockPredictionResult {
  ticker_symbol: string;
  company_name: string;
  current_market_price: number;
  ml_predicted_price: number;
  predicted_price_change: number;
  predicted_percentage_change: number;
  prediction_horizon_days: number;
  model_accuracy_r2_score: number;
  market_sentiment: {
    label: string;
    score: number;
  };
  timestamp: string;
  technical_indicators: {
    relative_strength_index: number | null;
    simple_moving_average_5: number | null;
    simple_moving_average_20: number | null;
    macd_line: number | null;
    bollinger_position: number | null;
  };
  pdm_strategy_analysis?: {
    signal_type: string;
    confidence_score: number;
    price_velocity: number;
    price_curvature: number;
    volume_sensitivity: number;
    institutional_volume_factor: number;
    atr_hard_stop_loss: number;
    atr_trailing_stop: number;
    strategy_description: string;
  };
}

export interface PDMOpportunity {
  ticker_symbol: string;
  signal_type: string;
  current_price: number;
  confidence_score: number;
  price_velocity: number;
  price_curvature: number;
  volume_sensitivity: number;
  institutional_factor: number;
  atr_stop_loss: number;
  trailing_stop: number;
  signal_timestamp: string;
}

export interface MarketHealthStatus {
  service_status: string;
  timestamp: string;
  ml_service_status: string;
  pdm_engine_status: string;
  supported_features: string[];
  version: string;
}

// Initialize React Query client
const reactQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Main application configuration
const applicationConfig = new ApplicationConfiguration();
const notificationService = new NotificationService();

const MainApplicationContent: React.FC = () => {
  // State management using Zustand store
  const {
    selectedStockTicker,
    isApplicationLoading,
    applicationErrorMessage,
    marketHealthStatus,
    setSelectedStockTicker,
    setIsApplicationLoading,
    setApplicationErrorMessage,
    setMarketHealthStatus,
  } = useFinancialDataStore();

  // Local state for navigation
  const [activeNavigationTab, setActiveNavigationTab] =
    useState<string>("overview");
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const initializeApplication = async () => {
    try {
      // Use the financialDataService instead of undefined fetchWithAuth
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/health`);
      const healthData = await response.json();

      console.log('Health check response:', healthData);

      // Check if backend is healthy
      if (!response.ok) {
        throw new Error('Backend services are not responding');
      }

      console.log('✅ Backend services initialized successfully');
      setIsInitialized(true);

    } catch (error) {
      console.error('Application initialization failed:', error);
      // Just log the error, don't block the app from loading
      setIsInitialized(true); // Allow app to load anyway
    }
  };



  // Initialize application on component mount
  useEffect(() => {
    initializeApplication();
  }, [initializeApplication]);

  // Periodically check system health
  useEffect(() => {
    if (!isInitialized) return;

    const healthCheckInterval = setInterval(async () => {
      try {
        const healthResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/health`);
        const healthData = await healthResponse.json();
        setMarketHealthStatus(healthData);
      } catch (error) {
        console.warn("Health check failed:", error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(healthCheckInterval);
  }, [isInitialized, setMarketHealthStatus]);

  // Handle navigation tab changes
  const handleNavigationTabChange = useCallback((tabName: string) => {
    setActiveNavigationTab(tabName);
  }, []);

  // Show loading spinner during initialization
  if (!isInitialized && isApplicationLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <h2 className="mt-4 text-xl font-semibold text-white">
            Initializing Roneira AI HIFI
          </h2>
          <p className="mt-2 text-slate-300">
            Connecting to financial intelligence services...
          </p>
        </div>
      </div>
    );
  }

  // Show error screen if initialization failed
  if (applicationErrorMessage && !isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-red-500 text-6xl mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-4">
            System Unavailable
          </h2>
          <p className="text-slate-300 mb-6">{applicationErrorMessage}</p>
          <button
            onClick={initializeApplication}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Retry Initialization
          </button>
        </div>
      </div>
    );
  }

  // Main application layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Navigation Header */}
      <NavigationHeader
        activeTab={activeNavigationTab}
        onTabChange={handleNavigationTabChange}
        marketHealthStatus={marketHealthStatus}
      />

      {/* Main Content Area */}
      <main className="container mx-auto px-4 py-6">
        <Routes>
          {/* Market Overview Dashboard */}
          <Route path="/overview" element={<MarketOverviewDashboard />} />

          {/* Stock Prediction Dashboard */}
          <Route
            path="/prediction"
            element={
              <StockPredictionDashboard
                selectedTicker={selectedStockTicker}
                onTickerChange={setSelectedStockTicker}
              />
            }
          />

          {/* PDM Strategy Dashboard */}
          <Route
            path="/pdm-strategy"
            element={
              <PDMStrategyDashboard marketHealthStatus={marketHealthStatus} />
            }
          />

          {/* Portfolio Management Dashboard */}
          <Route
            path="/portfolio"
            element={
              <PortfolioManagementDashboard
                selectedTicker={selectedStockTicker}
              />
            }
          />

          {/* Technical Analysis Dashboard */}
          <Route
            path="/analysis"
            element={
              <TechnicalAnalysisDashboard
                selectedTicker={selectedStockTicker}
              />
            }
          />

          {/* Default route redirect */}
          <Route path="/" element={<Navigate to="/overview" replace />} />

          {/* Fallback for unknown routes */}
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </main>
    </div>
  );
};

const EnhancedFinancialIntelligenceApp: React.FC = () => {
  return (
    <QueryClientProvider client={reactQueryClient}>
      <Router>
        <ErrorBoundary>
          <MainApplicationContent />

          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#1f2937",
                color: "#f9fafb",
                border: "1px solid #374151",
              },
              success: {
                iconTheme: {
                  primary: "#10b981",
                  secondary: "#f9fafb",
                },
              },
              error: {
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#f9fafb",
                },
              },
            }}
          />

          {/* React Query DevTools (only in development) */}
          {process.env.NODE_ENV === "development" && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </ErrorBoundary>
      </Router>
    </QueryClientProvider>
  );
};

export default EnhancedFinancialIntelligenceApp;
