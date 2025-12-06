/**
 * Stock Prediction Dashboard Component
 *
 * Enhanced stock prediction interface with ML models and PDM integration
 * Refined for robustness and "Senior ML Engineer" design standards.
 *
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Search,
  BarChart3,
  LineChart as LineChartIcon,
  Activity,
  Zap,
} from "lucide-react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
} from "recharts";
import { LoadingSpinner } from "../ui/LoadingSpinner";

interface StockPredictionDashboardProps {
  selectedTicker: string;
  onTickerChange: (ticker: string) => void;
}

export const StockPredictionDashboard: React.FC<
  StockPredictionDashboardProps
> = ({ selectedTicker, onTickerChange }) => {
  const [ticker, setTicker] = useState(selectedTicker);
  const [includePDM, setIncludePDM] = useState(true);

  // Fetch stock prediction and historical data
  const { data, isLoading } = useQuery({
    queryKey: ["stock-prediction", selectedTicker, includePDM],
    queryFn: async () => {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: selectedTicker,
          include_pdm: includePDM,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch prediction");
      }

      return response.json();
    },
    enabled: !!selectedTicker,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticker.trim()) {
      onTickerChange(ticker.trim().toUpperCase());
    }
  };

  const formatCurrency = (value: number | undefined | null) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value || 0);
  };

  const prediction = data?.data;

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 100 } },
  };

  return (
    <div className="space-y-8 p-4">
      {/* Search Header - Glassmorphism */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/80 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
            Market Intelligence
          </h2>
          <p className="text-gray-400 mb-6 text-sm">
            AI-Powered Predictive Analytics & PDM Strategy
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="SEARCH TICKER (e.g. AAPL)"
                className="w-full bg-black/50 text-white placeholder-gray-500 rounded-xl pl-12 pr-4 py-4 border border-white/10 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono tracking-wider"
              />
            </div>

            <div className="flex items-center gap-4 bg-black/30 px-6 rounded-xl border border-white/5">
              <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includePDM}
                  onChange={(e) => setIncludePDM(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-black/50"
                />
                <span className="font-medium">Enable PDM Engine</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !ticker.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95"
            >
              {isLoading ? (
                <LoadingSpinner size="small" />
              ) : (
                <Zap className="w-5 h-5 fill-current" />
              )}
              {isLoading ? "ANALYZING..." : "PREDICT"}
            </button>
          </form>
        </div>
      </motion.div>

      {/* Prediction Results */}
      {prediction && !isLoading && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Main Prediction Card */}
          <motion.div variants={itemVariants} className="bg-gray-900/60 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-1">Asset</h3>
                <span className="text-3xl font-bold text-white tracking-tight">
                  {prediction?.ticker_symbol || selectedTicker}
                </span>
              </div>
              <div className="text-right">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-1">Current</h3>
                <span className="text-2xl font-mono text-white">
                  {formatCurrency(prediction?.current_market_price)}
                </span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-900/20 to-black p-4 border border-blue-500/20">
                <div className="flex justify-between items-center relative z-10">
                  <span className="text-gray-400 text-xs uppercase font-medium">ML Predicted Price</span>
                  <Activity className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-4xl font-bold text-blue-400 font-mono mt-2">
                  {formatCurrency(prediction?.ml_predicted_price)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                  <p className="text-gray-500 text-xs uppercase mb-2">Change</p>
                  <div className="flex items-center gap-2">
                    {(prediction?.predicted_percentage_change || 0) > 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                    <span className={`text-lg font-bold font-mono ${(prediction?.predicted_percentage_change || 0) > 0 ? "text-green-500" : "text-red-500"}`}>
                      {(prediction?.predicted_percentage_change || 0) > 0 ? "+" : ""}
                      {((prediction?.predicted_percentage_change || 0)).toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                  <p className="text-gray-500 text-xs uppercase mb-2">Accuracy</p>
                  <div className="flex items-end gap-2">
                    <span className="text-lg font-bold text-blue-300 font-mono">
                      {((prediction?.model_accuracy_r2_score || 0) * 100).toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-500 mb-1">R² Score</span>
                  </div>
                </div>
              </div>

              {prediction?.market_sentiment && (
                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-500 text-xs uppercase">Sentiment Analysis</span>
                    <span className="text-xs font-mono text-gray-600">
                      {(prediction.market_sentiment.score * 100).toFixed(0)}% CONFIDENCE
                    </span>
                  </div>
                  <div className={`px-3 py-2 rounded-lg text-sm font-bold text-center uppercase tracking-wide
                    ${prediction.market_sentiment.label === "POSITIVE" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                      prediction.market_sentiment.label === "NEGATIVE" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                        "bg-gray-700/30 text-gray-400"}`
                  }>
                    {prediction.market_sentiment.label}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Technical Analysis Card */}
          <motion.div variants={itemVariants} className="bg-gray-900/60 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              Technical Indicators
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-black/40 border border-white/5">
                <span className="text-gray-400 text-sm">RSI (14)</span>
                <span className={`font-mono font-bold ${(prediction?.technical_indicators?.relative_strength_index || 50) > 70 ? "text-red-400" : (prediction?.technical_indicators?.relative_strength_index || 50) < 30 ? "text-green-400" : "text-white"}`}>
                  {(prediction?.technical_indicators?.relative_strength_index || 0).toFixed(1)}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-lg bg-black/40 border border-white/5">
                <span className="text-gray-400 text-sm">MACD</span>
                <span className={`font-mono font-bold ${(prediction?.technical_indicators?.macd_line || 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                  {(prediction?.technical_indicators?.macd_line || 0).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-lg bg-black/40 border border-white/5">
                <span className="text-gray-400 text-sm">SMA (20)</span>
                <span className="font-mono font-bold text-blue-300">
                  {formatCurrency(prediction?.technical_indicators?.simple_moving_average_20)}
                </span>
              </div>

              <div className="p-4 rounded-lg bg-black/40 border border-white/5 mt-4">
                <span className="text-gray-500 text-xs uppercase block mb-2">Bollinger Position</span>
                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${Math.min(Math.max((prediction?.technical_indicators?.bollinger_position || 0) * 100, 0), 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-600">Lower</span>
                  <span className="text-xs text-purple-400 font-mono">
                    {((prediction?.technical_indicators?.bollinger_position || 0) * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-gray-600">Upper</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* PDM Strategy Card */}
          {includePDM && prediction?.pdm_strategy_analysis && (
            <motion.div variants={itemVariants} className="bg-gradient-to-b from-gray-900/80 to-black/80 backdrop-blur-md border border-blue-500/20 p-6 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Activity className="w-24 h-24 text-blue-500" />
              </div>

              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 relative z-10">
                <Zap className="w-5 h-5 text-yellow-500" />
                PDM Strategy Engine
              </h3>

              <div className="space-y-6 relative z-10">
                <div className="text-center p-6 bg-black/60 rounded-xl border border-white/10">
                  <span className="text-gray-500 text-xs uppercase tracking-widest block mb-2">Signal Detected</span>
                  <span className={`text-2xl font-black uppercase tracking-widest px-4 py-1 rounded-lg border-2
                    ${prediction.pdm_strategy_analysis.signal_type === "LONG" ? "text-green-500 border-green-500 bg-green-900/10" :
                      prediction.pdm_strategy_analysis.signal_type === "EXIT" ? "text-red-500 border-red-500 bg-red-900/10" :
                        "text-gray-400 border-gray-600"}`}>
                    {prediction.pdm_strategy_analysis.signal_type}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                    <span className="text-gray-500 text-[10px] uppercase">Confidence</span>
                    <p className="text-xl font-bold text-white font-mono">
                      {((prediction.pdm_strategy_analysis.confidence_score || 0) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                    <span className="text-gray-500 text-[10px] uppercase">Velocity</span>
                    <p className={`text-xl font-bold font-mono ${(prediction.pdm_strategy_analysis.price_velocity || 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                      {(prediction.pdm_strategy_analysis.price_velocity || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-500 text-xs">Recommended Stop Loss</span>
                    <span className="text-red-400 font-mono font-bold text-sm">
                      {formatCurrency(prediction.pdm_strategy_analysis.atr_hard_stop_loss)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-xs">Trailing Stop</span>
                    <span className="text-orange-400 font-mono font-bold text-sm">
                      {formatCurrency(prediction.pdm_strategy_analysis.atr_trailing_stop)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Historical Chart - Full Width */}
          <motion.div variants={itemVariants} className="col-span-full bg-gray-900/60 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-xl mt-4">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <LineChartIcon className="w-5 h-5 text-blue-500" />
              Price Action History
            </h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={prediction?.historical_data || []}>
                  <defs>
                    <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#4b5563"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#4b5563"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#4b5563"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#000000",
                      border: "1px solid #333333",
                      borderRadius: "8px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                    }}
                    itemStyle={{ color: "#e5e7eb" }}
                    labelStyle={{ color: "#9ca3af", marginBottom: "0.5rem" }}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="close"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorClose)"
                    name="Close Price"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="sma20"
                    stroke="#9ca3af"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                    name="SMA 20"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="volume"
                    fill="#374151"
                    opacity={0.3}
                    name="Volume"
                    barSize={4}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Empty State / Loading - Minimalist */}
      {!prediction && !isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center p-20 border border-white/5 rounded-3xl bg-black/20"
        >
          <div className="bg-gray-900 p-6 rounded-full mb-6 border border-white/10 shadow-xl">
            <LineChartIcon className="w-12 h-12 text-blue-500/50" />
          </div>
          <h3 className="text-xl font-medium text-white mb-2">Ready to Analyze</h3>
          <p className="text-gray-500 max-w-md text-center text-sm">
            Enter a ticker symbol above to generate AI-powered price predictions and proprietary PDM strategy signals.
          </p>
        </motion.div>
      )}
    </div>
  );
};
