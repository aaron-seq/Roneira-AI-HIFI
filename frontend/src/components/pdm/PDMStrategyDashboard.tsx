/**
 * PDM Strategy Dashboard Component
 *
 * Comprehensive dashboard for Price-Volume Derivatives Momentum Strategy
 * with stock search, real-time analysis, and strategy education.
 *
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Zap,
  Clock,
  Search,
  BookOpen,
  Shield,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";
import type { MarketHealthStatus, PDMOpportunity } from "../../types";
import { useFinancialDataStore } from "../../store/financialDataStore";
import { LoadingSpinner } from "../ui/LoadingSpinner";

interface PDMStrategyDashboardProps {
  marketHealthStatus: MarketHealthStatus | null;
}

interface PDMAnalysisResult {
  ticker: string;
  current_price: number;
  predicted_price: number;
  price_change_percent: number;
  pdm_analysis: {
    signal: string;
    strength: number;
    momentum: number;
    volume_score: number;
  };
  technical_indicators: {
    rsi: number;
    macd: number;
    sma_20: number;
    sma_50: number;
  };
}

interface PDMSignalCardProps {
  signal: PDMOpportunity;
}

// Popular stocks for quick PDM analysis
const POPULAR_TICKERS = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NVDA', 'AMD'];

const PDMSignalCard: React.FC<PDMSignalCardProps> = ({ signal }) => {
  const getSignalIcon = () => {
    switch (signal.signal_type) {
      case "LONG":
        return <TrendingUp className="w-5 h-5 text-green-400" />;
      case "EXIT":
        return <TrendingDown className="w-5 h-5 text-red-400" />;
      default:
        return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const getSignalColor = () => {
    switch (signal.signal_type) {
      case "LONG":
        return "border-green-500 bg-green-900/20";
      case "EXIT":
        return "border-red-500 bg-red-900/20";
      default:
        return "border-gray-500 bg-gray-900/20";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className={`border-l-4 p-4 rounded-lg ${getSignalColor()}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getSignalIcon()}
          <span className="font-bold text-white text-lg">
            {signal.ticker_symbol.replace(".NS", "")}
          </span>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-semibold ${signal.signal_type === "LONG"
            ? "bg-green-600 text-white"
            : "bg-gray-600 text-gray-200"
            }`}
        >
          {signal.signal_type}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-400 text-sm">Current Price:</span>
          <span className="text-white font-semibold">
            {formatCurrency(signal.current_price)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400 text-sm">Confidence:</span>
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gray-600 rounded-full">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
                style={{ width: `${signal.confidence_score * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-300">
              {(signal.confidence_score * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-600">
          <div>
            <p className="text-xs text-gray-400">Price Velocity</p>
            <p
              className={`text-sm font-semibold ${signal.price_velocity > 0 ? "text-green-400" : "text-red-400"
                }`}
            >
              {signal.price_velocity > 0 ? "+" : ""}
              {signal.price_velocity.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Volume Factor</p>
            <p className="text-sm font-semibold text-cyan-400">
              {signal.institutional_factor.toFixed(2)}x
            </p>
          </div>
        </div>

        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Stop: {formatCurrency(signal.atr_stop_loss)}</span>
          <span>Trail: {formatCurrency(signal.trailing_stop)}</span>
        </div>

        <div className="text-xs text-gray-500 mt-2">
          <Clock className="w-3 h-3 inline mr-1" />
          {new Date(signal.signal_timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export const PDMStrategyDashboard: React.FC<PDMStrategyDashboardProps> = ({
  marketHealthStatus,
}) => {
  const {
    pdmOpportunities,
    pdmScanInProgress,
    setPDMOpportunities,
    setPDMScanInProgress,
  } = useFinancialDataStore();

  // State for stock search
  const [searchTicker, setSearchTicker] = useState("");
  const [activeTicker, setActiveTicker] = useState("");
  const [showStrategyInfo, setShowStrategyInfo] = useState(true);

  interface BacktestResults {
    backtest_results?: {
      period: string;
      strategy_return: string;
      benchmark_return: string;
    };
  }

  const [backtestResults, setBacktestResults] = useState<BacktestResults | null>(null);
  const [isBacktestLoading, setIsBacktestLoading] = useState(false);

  // Query for single stock PDM analysis
  const { data: pdmAnalysis, isLoading: isAnalyzing, error: analysisError, refetch: refetchAnalysis } = useQuery<PDMAnalysisResult>({
    queryKey: ['pdm-analysis', activeTicker],
    queryFn: async () => {
      const ML_API_BASE_URL = import.meta.env.VITE_ML_API_BASE_URL || 'http://localhost:8000';
      console.log(`[PDM] Fetching PDM analysis for ${activeTicker}`);
      
      const response = await fetch(`${ML_API_BASE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: activeTicker,
          include_pdm: true,
          model_type: 'random_forest',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch PDM analysis');
      }

      const result = await response.json();
      console.log(`[PDM] Received analysis:`, result);
      return result;
    },
    enabled: !!activeTicker,
    staleTime: 60000,
  });

  // Query for PDM opportunities
  const { data: opportunitiesData, refetch: refetchOpportunities } = useQuery({
    queryKey: ["pdm-opportunities"],
    queryFn: async () => {
      const response = await fetch("/api/pdm/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookback_days: 252, min_liquidity: 1000000 }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch PDM opportunities");
      }

      return response.json();
    },
    refetchInterval: 60000,
  });

  // Sync data to store when fetched
  useEffect(() => {
    if (opportunitiesData) {
      setPDMOpportunities(opportunitiesData.signals || []);
    }
  }, [opportunitiesData, setPDMOpportunities]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchTicker.trim()) {
      setActiveTicker(searchTicker.trim().toUpperCase());
    }
  }, [searchTicker]);

  const handleQuickSelect = (ticker: string) => {
    setSearchTicker(ticker);
    setActiveTicker(ticker);
  };

  const handleScanOpportunities = async () => {
    setPDMScanInProgress(true);
    try {
      await refetchOpportunities();
    } finally {
      setPDMScanInProgress(false);
    }
  };

  const handleRunBacktest = async () => {
    setIsBacktestLoading(true);
    try {
      const response = await fetch("/api/pdm/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: "2025-04-01",
          end_date: "2025-10-01",
          initial_capital: 1000000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBacktestResults(data);
      }
    } catch (error) {
      console.error("Backtest error:", error);
    } finally {
      setIsBacktestLoading(false);
    }
  };

  const formatCurrency = (value: number | undefined) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0);
  };

  const getSignalColor = (signal: string | undefined) => {
    switch (signal?.toUpperCase()) {
      case 'BUY': return 'text-green-400 bg-green-500/10 border-green-500';
      case 'SELL': return 'text-red-400 bg-red-500/10 border-red-500';
      default: return 'text-yellow-400 bg-yellow-500/10 border-yellow-500';
    }
  };

  const strategyStats = {
    strategyReturn: backtestResults?.backtest_results?.strategy_return || "Run Backtest",
    benchmarkReturn: backtestResults?.backtest_results?.benchmark_return || "N/A",
    outperformance: backtestResults?.backtest_results?.strategy_return && backtestResults?.backtest_results?.benchmark_return 
      ? `${(parseFloat(backtestResults.backtest_results.strategy_return) - parseFloat(backtestResults.backtest_results.benchmark_return)).toFixed(1)}%`
      : "N/A",
    maxPositions: 25,
    currentPositions: pdmOpportunities.length,
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header with Search */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-gray-900/90 to-black/90 backdrop-blur-xl border border-white/10 p-6 rounded-2xl"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              PDM Strategy Engine
            </h2>
            <p className="text-gray-400 text-sm">
              Price-Volume Derivatives Momentum Analysis
            </p>
          </div>

          {/* Stock Search */}
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                value={searchTicker}
                onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
                placeholder="Enter ticker..."
                className="w-full bg-black/50 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 border border-white/10 focus:border-cyan-500/50 focus:outline-none font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isAnalyzing}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2"
            >
              {isAnalyzing ? <LoadingSpinner size="small" /> : <Zap className="w-5 h-5" />}
              Analyze
            </button>
          </form>
        </div>

        {/* Quick Access Tickers */}
        <div className="flex flex-wrap gap-2">
          {POPULAR_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => handleQuickSelect(t)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                activeTicker === t
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </motion.div>

      {/* PDM Analysis Result for Selected Stock */}
      {activeTicker && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-6"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-white">{activeTicker} PDM Analysis</h3>
              <p className="text-gray-400 text-sm">Real-time momentum and trading signals</p>
            </div>
            {pdmAnalysis && (
              <div className={`px-4 py-2 rounded-xl border-2 font-bold text-lg ${getSignalColor(pdmAnalysis.pdm_analysis?.signal)}`}>
                {pdmAnalysis.pdm_analysis?.signal || 'HOLD'}
              </div>
            )}
          </div>

          {isAnalyzing ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="large" />
              <span className="ml-3 text-gray-400">Analyzing {activeTicker}...</span>
            </div>
          ) : analysisError ? (
            <div className="text-red-400 p-4 bg-red-900/20 rounded-lg">
              Failed to analyze {activeTicker}. Please try again.
            </div>
          ) : pdmAnalysis ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Current Price */}
              <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                <p className="text-gray-500 text-xs uppercase mb-1">Current Price</p>
                <p className="text-2xl font-bold text-white font-mono">
                  {formatCurrency(pdmAnalysis.current_price)}
                </p>
                <p className={`text-sm ${(pdmAnalysis.price_change_percent || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(pdmAnalysis.price_change_percent || 0) >= 0 ? '+' : ''}{(pdmAnalysis.price_change_percent || 0).toFixed(2)}%
                </p>
              </div>

              {/* Signal Strength */}
              <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                <p className="text-gray-500 text-xs uppercase mb-1">Signal Strength</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {((pdmAnalysis.pdm_analysis?.strength || 0) * 100).toFixed(0)}%
                </p>
                <div className="mt-2 h-2 bg-gray-700 rounded-full">
                  <div 
                    className="h-full bg-cyan-500 rounded-full"
                    style={{ width: `${(pdmAnalysis.pdm_analysis?.strength || 0) * 100}%` }}
                  />
                </div>
              </div>

              {/* Momentum */}
              <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                <p className="text-gray-500 text-xs uppercase mb-1">Price Momentum</p>
                <p className={`text-2xl font-bold ${(pdmAnalysis.pdm_analysis?.momentum || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {((pdmAnalysis.pdm_analysis?.momentum || 0) * 100).toFixed(2)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {(pdmAnalysis.pdm_analysis?.momentum || 0) > 0 ? 'Accelerating' : 'Decelerating'}
                </p>
              </div>

              {/* Volume Score */}
              <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                <p className="text-gray-500 text-xs uppercase mb-1">Volume Score</p>
                <p className="text-2xl font-bold text-purple-400">
                  {((pdmAnalysis.pdm_analysis?.volume_score || 0) * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {(pdmAnalysis.pdm_analysis?.volume_score || 0) > 0.6 ? 'High Activity' : 'Normal Activity'}
                </p>
              </div>

              {/* Technical Indicators */}
              <div className="md:col-span-2 bg-black/40 rounded-xl p-4 border border-white/5">
                <p className="text-gray-500 text-xs uppercase mb-3">Technical Indicators</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400 text-sm">RSI (14)</span>
                    <span className={`float-right font-mono ${
                      (pdmAnalysis.technical_indicators?.rsi || 50) > 70 ? 'text-red-400' :
                      (pdmAnalysis.technical_indicators?.rsi || 50) < 30 ? 'text-green-400' : 'text-white'
                    }`}>
                      {(pdmAnalysis.technical_indicators?.rsi || 50).toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">MACD</span>
                    <span className={`float-right font-mono ${
                      (pdmAnalysis.technical_indicators?.macd || 0) > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {(pdmAnalysis.technical_indicators?.macd || 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">SMA 20</span>
                    <span className="float-right font-mono text-white">
                      {formatCurrency(pdmAnalysis.technical_indicators?.sma_20)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">SMA 50</span>
                    <span className="float-right font-mono text-white">
                      {formatCurrency(pdmAnalysis.technical_indicators?.sma_50)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trading Recommendation */}
              <div className="md:col-span-2 bg-black/40 rounded-xl p-4 border border-white/5">
                <p className="text-gray-500 text-xs uppercase mb-3">Trading Recommendation</p>
                <div className="flex items-start gap-3">
                  {pdmAnalysis.pdm_analysis?.signal === 'BUY' ? (
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                  ) : pdmAnalysis.pdm_analysis?.signal === 'SELL' ? (
                    <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  ) : (
                    <Info className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-white font-medium">
                      {pdmAnalysis.pdm_analysis?.signal === 'BUY' 
                        ? `Strong momentum detected. Consider entry at ${formatCurrency(pdmAnalysis.current_price)}.`
                        : pdmAnalysis.pdm_analysis?.signal === 'SELL'
                          ? `Momentum weakening. Consider reducing position or setting tight stops.`
                          : `Neutral momentum. Wait for clearer signal before taking action.`}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      Stop Loss: {formatCurrency(pdmAnalysis.current_price * 0.95)} | 
                      Target: {formatCurrency(pdmAnalysis.predicted_price)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      )}

      {/* Strategy Information Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gray-900/60 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden"
      >
        <button
          onClick={() => setShowStrategyInfo(!showStrategyInfo)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-semibold text-white">
              Understanding the PDM Strategy
            </span>
          </div>
          <span className="text-gray-400">{showStrategyInfo ? '−' : '+'}</span>
        </button>

        {showStrategyInfo && (
          <div className="p-6 pt-0 space-y-6">
            {/* What is PDM */}
            <div>
              <h4 className="text-cyan-400 font-semibold mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                What is PDM Strategy?
              </h4>
              <p className="text-gray-300 text-sm leading-relaxed">
                The Price-Volume Derivatives Momentum (PDM) strategy is a quantitative trading approach 
                that uses mathematical calculus to detect institutional momentum in stock prices. 
                By analyzing the rate of change (derivatives) of both price and volume, the strategy 
                identifies high-probability trading opportunities before they become obvious to the market.
              </p>
            </div>

            {/* Mathematical Framework */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <h5 className="text-cyan-400 font-semibold mb-2">df/dt - Price Velocity</h5>
                <p className="text-gray-400 text-sm">
                  First derivative of price. Measures the speed and direction of price movement. 
                  Positive velocity indicates upward momentum.
                </p>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <h5 className="text-yellow-400 font-semibold mb-2">d²f/dt² - Price Acceleration</h5>
                <p className="text-gray-400 text-sm">
                  Second derivative of price. Detects acceleration or deceleration in trends. 
                  Helps identify early trend reversals.
                </p>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <h5 className="text-green-400 font-semibold mb-2">df/dV - Volume Sensitivity</h5>
                <p className="text-gray-400 text-sm">
                  Price change relative to volume. High sensitivity indicates institutional 
                  interest and potential breakout opportunities.
                </p>
              </div>
            </div>

            {/* How it Helps Trading */}
            <div>
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-green-400" />
                How PDM Helps Your Trading
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Early Signal Detection</p>
                    <p className="text-gray-400 text-sm">Identifies momentum shifts 2-3 days before traditional indicators.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Risk Management</p>
                    <p className="text-gray-400 text-sm">ATR-based stop losses and trailing stops protect capital.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Institutional Flow Detection</p>
                    <p className="text-gray-400 text-sm">Volume analysis reveals smart money accumulation patterns.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Objective Decision Making</p>
                    <p className="text-gray-400 text-sm">Mathematical signals remove emotional bias from trading.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Signal Interpretation */}
            <div>
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                Signal Interpretation Guide
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-bold">BUY Signal</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Strong upward momentum with increasing volume. Consider entering 
                    long positions with defined stop loss.
                  </p>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5 text-yellow-400" />
                    <span className="text-yellow-400 font-bold">HOLD Signal</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Neutral momentum with no clear direction. Maintain existing 
                    positions but avoid new entries.
                  </p>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-5 h-5 text-red-400" />
                    <span className="text-red-400 font-bold">SELL Signal</span>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Weakening momentum or reversal detected. Consider taking profits 
                    or reducing position size.
                  </p>
                </div>
              </div>
            </div>

            {/* Risk Warning */}
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 flex gap-3">
              <Shield className="w-6 h-6 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-yellow-400 font-semibold">Risk Disclaimer</p>
                <p className="text-gray-300 text-sm">
                  This strategy is for educational purposes. Past performance does not guarantee future results. 
                  Always conduct your own research and consider your risk tolerance before trading. 
                  Never invest more than you can afford to lose.
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Strategy Performance Metrics */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gray-900/60 border border-white/10 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Strategy Performance</h3>
          <div className="flex gap-2">
            <button
              onClick={handleScanOpportunities}
              disabled={pdmScanInProgress}
              className="bg-gray-800 hover:bg-gray-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              {pdmScanInProgress ? <LoadingSpinner size="small" /> : <Zap className="w-4 h-4" />}
              Scan Universe
            </button>
            <button
              onClick={handleRunBacktest}
              disabled={isBacktestLoading}
              className="bg-gray-800 hover:bg-gray-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              {isBacktestLoading ? <LoadingSpinner size="small" /> : <Target className="w-4 h-4" />}
              Backtest
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-black/40 p-4 rounded-xl border border-white/5">
            <p className="text-gray-500 text-xs uppercase">Strategy Return</p>
            <p className="text-xl font-bold text-green-400">{strategyStats.strategyReturn}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-xl border border-white/5">
            <p className="text-gray-500 text-xs uppercase">Benchmark</p>
            <p className="text-xl font-bold text-white">{strategyStats.benchmarkReturn}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-xl border border-white/5">
            <p className="text-gray-500 text-xs uppercase">Outperformance</p>
            <p className="text-xl font-bold text-green-400">{strategyStats.outperformance}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-xl border border-white/5">
            <p className="text-gray-500 text-xs uppercase">Active Positions</p>
            <p className="text-xl font-bold text-cyan-400">{strategyStats.currentPositions}/{strategyStats.maxPositions}</p>
          </div>
          <div className="bg-black/40 p-4 rounded-xl border border-white/5">
            <p className="text-gray-500 text-xs uppercase">System Status</p>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${marketHealthStatus?.service_status === "healthy" ? "bg-green-500" : "bg-red-500"}`} />
              <p className="text-sm font-semibold text-white capitalize">{marketHealthStatus?.service_status || "Unknown"}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Active PDM Signals */}
      {pdmOpportunities.length > 0 && (
        <div className="bg-gray-900/60 border border-white/10 p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">
            Active PDM Signals ({pdmOpportunities.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pdmOpportunities.map((signal: PDMOpportunity, index: number) => (
              <PDMSignalCard key={`${signal.ticker_symbol}-${index}`} signal={signal} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
