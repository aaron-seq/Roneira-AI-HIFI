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
  useNavigate,
  useLocation,
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
import { NewsDashboard } from "../../components/news/NewsDashboard";
// Import utilities and types
import { useFinancialDataStore } from "../../store/financialDataStore";
import { fetchMarketHealth } from "../../services/financialDataService";


// Initialize React Query client
const reactQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
    },
  },
});

// Main application configuration

const MainApplicationContent: React.FC = () => {
  // State management using Zustand store
  const {
    selectedStockTicker,
    isApplicationLoading,
    applicationErrorMessage,
    marketHealthStatus,
    setSelectedStockTicker,
    setMarketHealthStatus,
  } = useFinancialDataStore();

  const navigate = useNavigate();
  const location = useLocation();

  // Sync active tab with URL location
  useEffect(() => {
    const path = location.pathname.substring(1); // remove leading slash
    if (path) {
      setActiveNavigationTab(path);
    }
  }, [location]);

  // Local state for navigation
  const [activeNavigationTab, setActiveNavigationTab] =
    useState<string>("overview");
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const initializeApplication = async () => {
    try {
      // Use the financialDataService helper with correct endpoint
      const healthData = await fetchMarketHealth();

      console.log('Health check response:', healthData);

      // We consider initialized if we get a response, even if service status is unknown (offline mode support)
      setMarketHealthStatus(healthData);
      console.log('✅ Backend services initialized successfully');
      setIsInitialized(true);

    } catch (error) {
      console.error('Application initialization failed:', error);
      // Just log the error, don't block the app from loading
      setIsInitialized(true);
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
        const healthData = await fetchMarketHealth();
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
    navigate(`/${tabName}`);
  }, [navigate]);

  // Wait, I need to use navigate.
  // I will refactor this in a separate step or just assume the user clicks the tab and it updates state?
  // Actually, NavigationHeader just calls onTabChange.
  // The Routes are matched by URL path.
  // We need to sync `activeNavigationTab` state with URL or vice versa.
  // For now, let's keep it simple and just rely on the user clicking which updates the internal state 
  // AND pushes a navigation event?
  // Ah, the `NavigationHeader` uses simple `button`s.
  // I should update `handleNavigationTabChange` to actually navigate.

  // Let's fix the logic below this comment block with a proper implementation.
  // Since I can't use hooks conditionally or easily inside `replace`, 
  // I will just use `window.history.pushState` or similar if I can't import `useNavigate` easily at top level.
  // But wait, `MainApplicationContent` IS inside `Router`.
  // So I can use `useNavigate`.

  // I'll skip this specific Replace and do it properly in the next step.


  // Show loading spinner during initialization
  if (!isInitialized && isApplicationLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <h2 className="mt-4 text-xl font-medium text-gold-400 tracking-wider">
            INITIALIZING RONEIRA AI
          </h2>
          <p className="mt-2 text-gray-500 text-sm tracking-wide">
            Establishing Secure Connection...
          </p>
        </div>
      </div>
    );
  }

  // Show error screen if initialization failed
  if (applicationErrorMessage && !isInitialized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8 border border-red-900/30 rounded-lg bg-red-950/10">
          <div className="text-red-500 text-6xl mb-4"></div>
          <h2 className="text-2xl font-bold text-red-500 mb-2 tracking-wide">
            SYSTEM UNAVAILABLE
          </h2>
          <p className="text-gray-400 mb-8">{applicationErrorMessage}</p>
          <button
            onClick={initializeApplication}
            className="bg-gold-600 hover:bg-gold-500 text-black font-bold py-3 px-8 rounded transition-all duration-300 tracking-wider uppercase text-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Main application layout
  return (
    <div className="min-h-screen bg-black text-gray-100 selection:bg-gold-500 selection:text-black">
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
                selectedTicker={selectedStockTicker || ""}
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
                selectedTicker={selectedStockTicker || ""}
              />
            }
          />

          {/* Technical Analysis Dashboard */}
          <Route
            path="/analysis"
            element={
              <TechnicalAnalysisDashboard
                selectedTicker={selectedStockTicker || ""}
              />
            }
          />

          {/* News Dashboard */}
          <Route path="/news" element={<NewsDashboard />} />

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
          {import.meta.env.DEV && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </ErrorBoundary>
      </Router>
    </QueryClientProvider>
  );
};

export default EnhancedFinancialIntelligenceApp;
