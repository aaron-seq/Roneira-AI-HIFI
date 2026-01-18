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

  const initializeApplication = useCallback(async () => {
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
  }, [setMarketHealthStatus]);

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center relative">
          <div className="relative">
            <LoadingSpinner size="large" />
            <h2 className="mt-6 text-xl font-semibold tracking-tight text-text-main">
              Initializing Roneira AI
            </h2>
            <p className="mt-2 text-text-muted text-sm">
              Establishing connection...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error screen if initialization failed
  if (applicationErrorMessage && !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bearish-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-danger mb-2">
            System Unavailable
          </h2>
          <p className="text-text-muted mb-8">{applicationErrorMessage}</p>
          <button
            onClick={initializeApplication}
            className="btn-primary"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Main application layout
  return (
    <div className="min-h-screen bg-background text-text-main selection:bg-primary/20 selection:text-primary">
      {/* Navigation Header */}
      <NavigationHeader
        activeTab={activeNavigationTab}
        onTabChange={handleNavigationTabChange}
        marketHealthStatus={marketHealthStatus}
      />

      {/* Main Content Area */}
      <main className="animate-fade-in">
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

          {/* Toast notifications - Groww style */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#FFFFFF",
                color: "#44475B",
                border: "1px solid #E8EAED",
                borderRadius: "12px",
                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)",
              },
              success: {
                iconTheme: {
                  primary: "#00D09C",
                  secondary: "#FFFFFF",
                },
              },
              error: {
                iconTheme: {
                  primary: "#EB5B3C",
                  secondary: "#FFFFFF",
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
