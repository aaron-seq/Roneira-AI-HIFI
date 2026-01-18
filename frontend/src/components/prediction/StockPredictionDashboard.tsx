/**
 * Stock Prediction Dashboard Component
 *
 * Enhanced stock prediction interface with ML models and PDM integration
 * Groww-inspired clean design with soft aesthetics.
 *
 * Author: Aaron Sequeira
 * Company: Roneira AI
 * @version 2026 Groww Theme
 */

import React, { useState, useEffect } from "react";
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
  const [modelType, setModelType] = useState<'random_forest' | 'lstm' | 'gan'>('random_forest');

  const MODEL_OPTIONS = [
    { value: 'random_forest', label: 'Random Forest', description: 'Ensemble tree-based model, fast and reliable' },
    { value: 'lstm', label: 'LSTM Neural Network', description: 'Deep learning for sequence prediction (Coming Soon)' },
    { value: 'gan', label: 'GAN Model', description: 'Generative adversarial network (Coming Soon)' },
  ];

  // Fetch stock prediction and historical data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["stock-prediction", selectedTicker, includePDM, modelType],
    queryFn: async () => {
      const ML_API_BASE_URL = import.meta.env.VITE_ML_API_BASE_URL || 'http://localhost:8000';
      console.log(`[StockPrediction] Fetching prediction for ${selectedTicker} from ${ML_API_BASE_URL}`);
      const response = await fetch(`${ML_API_BASE_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: selectedTicker,
          include_pdm: includePDM,
          model_type: modelType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch prediction");
      }

      const result = await response.json();
      console.log(`[StockPrediction] Received prediction:`, result);
      return { data: result };
    },
    enabled: false, // Disable auto-fetch, use manual refetch
    retry: 1,
  });


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticker.trim()) {
      const newTicker = ticker.trim().toUpperCase();
      console.log(`[StockPrediction] Submit clicked for ticker: ${newTicker}`);
      onTickerChange(newTicker);
      // Trigger refetch after a short delay to ensure state is updated
      setTimeout(() => {
        console.log(`[StockPrediction] Triggering refetch...`);
        refetch();
      }, 100);
    }
  };

  // Sync local ticker state with selectedTicker prop
  useEffect(() => {
    if (selectedTicker) {
      setTicker(selectedTicker);
    }
  }, [selectedTicker]);

  const formatCurrency = (value: number | undefined | null) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(value || 0);
  };

  // Map ML API response to template expected properties
  const rawPrediction = data?.data;
  const prediction = rawPrediction ? {
    ticker_symbol: rawPrediction.ticker,
    current_market_price: rawPrediction.current_price,
    ml_predicted_price: rawPrediction.predicted_price,
    predicted_percentage_change: rawPrediction.price_change_percent,
    predicted_price_change: rawPrediction.price_change,
    model_accuracy_r2_score: rawPrediction.confidence,
    market_sentiment: rawPrediction.sentiment ? {
      label: rawPrediction.sentiment.label?.toUpperCase() || 'NEUTRAL',
      score: rawPrediction.sentiment.confidence || 0.5
    } : null,
    technical_indicators: rawPrediction.technical_indicators ? {
      relative_strength_index: rawPrediction.technical_indicators.rsi,
      macd_line: rawPrediction.technical_indicators.macd,
      simple_moving_average_20: rawPrediction.technical_indicators.sma_20,
      bollinger_position: 0.5 // Default value
    } : null,
    pdm_strategy_analysis: rawPrediction.pdm_analysis ? {
      signal_type: rawPrediction.pdm_analysis.signal?.toUpperCase() || 'HOLD',
      confidence_score: rawPrediction.pdm_analysis.strength || 0,
      price_velocity: rawPrediction.pdm_analysis.momentum || 0,
      atr_hard_stop_loss: rawPrediction.current_price * 0.95,
      atr_trailing_stop: rawPrediction.current_price * 0.97
    } : null,
    historical_data: []
  } : null;

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
    <div className="space-y-6 p-6 bg-background min-h-screen">
      {/* Search Header - Clean Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8"
      >
        <div className="relative z-10">
          <h2 className="text-2xl font-semibold text-text-main mb-1">
            Market Intelligence
          </h2>
          <p className="text-text-muted mb-6 text-sm">
            AI-Powered Predictive Analytics & PDM Strategy
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-muted w-5 h-5" />
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="SEARCH TICKER (e.g. RELIANCE)"
                  className="input pl-12 font-mono tracking-wider"
                />
              </div>

              {/* Model Selection Dropdown */}
              <div className="relative">
                <select
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value as 'random_forest' | 'lstm' | 'gan')}
                  className="input cursor-pointer pr-10 min-w-[180px]"
                >
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <BarChart3 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted w-4 h-4 pointer-events-none" />
              </div>

              <div className="flex items-center gap-4 bg-slate-50 px-6 rounded-xl border border-slate-200">
                <label className="flex items-center gap-3 text-sm text-text-secondary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includePDM}
                    onChange={(e) => setIncludePDM(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="font-medium">Enable PDM</span>
                </label>
              </div>

              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isLoading || !ticker.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <LoadingSpinner size="small" />
                ) : (
                  <Zap className="w-5 h-5 fill-current" />
                )}
                {isLoading ? "ANALYZING..." : "PREDICT"}
              </button>
            </div>

            {/* Model Description */}
            <div className="text-xs text-text-muted">
              {MODEL_OPTIONS.find(m => m.value === modelType)?.description}
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-bearish-50 border border-danger/20 rounded-xl p-3 text-danger text-sm">
                {(error as Error).message}
              </div>
            )}
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
          <motion.div variants={itemVariants} className="card p-6">
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-1">Asset</h3>
                <span className="text-2xl font-semibold text-text-main tracking-tight">
                  {prediction?.ticker_symbol || selectedTicker}
                </span>
              </div>
              <div className="text-right">
                <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-1">Current</h3>
                <span className="text-xl font-mono text-text-main tabular-nums">
                  {formatCurrency(prediction?.current_market_price)}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-xl bg-primary/5 p-5 border border-primary/10">
                <div className="flex justify-between items-center relative z-10">
                  <span className="text-text-muted text-xs uppercase font-medium">ML Predicted Price</span>
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <p className="text-3xl font-semibold text-primary font-mono mt-2 tabular-nums">
                  {formatCurrency(prediction?.ml_predicted_price)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl">
                  <p className="text-text-muted text-xs uppercase mb-2">Change</p>
                  <div className="flex items-center gap-2">
                    {(prediction?.predicted_percentage_change || 0) > 0 ? (
                      <TrendingUp className="w-5 h-5 text-secondary" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-danger" />
                    )}
                    <span className={`text-lg font-semibold font-mono tabular-nums ${(prediction?.predicted_percentage_change || 0) > 0 ? "text-secondary" : "text-danger"}`}>
                      {(prediction?.predicted_percentage_change || 0) > 0 ? "+" : ""}
                      {((prediction?.predicted_percentage_change || 0)).toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl">
                  <p className="text-text-muted text-xs uppercase mb-2">Accuracy</p>
                  <div className="flex items-end gap-2">
                    <span className="text-lg font-semibold text-text-main font-mono tabular-nums">
                      {((prediction?.model_accuracy_r2_score || 0) * 100).toFixed(1)}%
                    </span>
                    <span className="text-xs text-text-muted mb-1">R² Score</span>
                  </div>
                </div>
              </div>

              {prediction?.market_sentiment && (
                <div className="bg-slate-50 p-4 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-text-muted text-xs uppercase">Sentiment Analysis</span>
                    <span className="text-xs font-mono text-text-muted">
                      {(prediction.market_sentiment.score * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <div className={`px-3 py-2 rounded-lg text-sm font-semibold text-center uppercase tracking-wide
                    ${prediction.market_sentiment.label === "POSITIVE" ? "bg-bullish-50 text-secondary" :
                      prediction.market_sentiment.label === "NEGATIVE" ? "bg-bearish-50 text-danger" :
                        "bg-slate-100 text-text-secondary"}`
                  }>
                    {prediction.market_sentiment.label}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Technical Analysis Card */}
          <motion.div variants={itemVariants} className="card p-6">
            <h3 className="text-lg font-semibold text-text-main mb-6 flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              Technical Indicators
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                <span className="text-text-secondary text-sm">RSI (14)</span>
                <span className={`font-mono font-semibold tabular-nums ${(prediction?.technical_indicators?.relative_strength_index || 50) > 70 ? "text-danger" : (prediction?.technical_indicators?.relative_strength_index || 50) < 30 ? "text-secondary" : "text-text-main"}`}>
                  {(prediction?.technical_indicators?.relative_strength_index || 0).toFixed(1)}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                <span className="text-text-secondary text-sm">MACD</span>
                <span className={`font-mono font-semibold tabular-nums ${(prediction?.technical_indicators?.macd_line || 0) > 0 ? "text-secondary" : "text-danger"}`}>
                  {(prediction?.technical_indicators?.macd_line || 0).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                <span className="text-text-secondary text-sm">SMA (20)</span>
                <span className="font-mono font-semibold text-text-main tabular-nums">
                  {formatCurrency(prediction?.technical_indicators?.simple_moving_average_20)}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 mt-4">
                <span className="text-text-muted text-xs uppercase block mb-2">Bollinger Position</span>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(Math.max((prediction?.technical_indicators?.bollinger_position || 0) * 100, 0), 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-text-muted">Lower</span>
                  <span className="text-xs text-primary font-mono tabular-nums">
                    {((prediction?.technical_indicators?.bollinger_position || 0) * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-text-muted">Upper</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* PDM Strategy Card */}
          {includePDM && prediction?.pdm_strategy_analysis && (
            <motion.div variants={itemVariants} className="card p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Activity className="w-24 h-24 text-primary" />
              </div>

              <h3 className="text-lg font-semibold text-text-main mb-6 flex items-center gap-2 relative z-10">
                <div className="p-2 rounded-xl bg-neutral-100">
                  <Zap className="w-5 h-5 text-neutral-600" />
                </div>
                PDM Strategy Engine
              </h3>

              <div className="space-y-6 relative z-10">
                <div className="text-center p-6 bg-slate-50 rounded-xl">
                  <span className="text-text-muted text-xs uppercase tracking-widest block mb-2">Signal Detected</span>
                  <span className={`text-xl font-bold uppercase tracking-widest px-4 py-2 rounded-xl
                    ${prediction.pdm_strategy_analysis.signal_type === "LONG" ? "text-secondary bg-bullish-50" :
                      prediction.pdm_strategy_analysis.signal_type === "EXIT" ? "text-danger bg-bearish-50" :
                        "text-text-secondary bg-slate-100"}`}>
                    {prediction.pdm_strategy_analysis.signal_type}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <span className="text-text-muted text-[10px] uppercase">Confidence</span>
                    <p className="text-xl font-semibold text-text-main font-mono tabular-nums">
                      {((prediction.pdm_strategy_analysis.confidence_score || 0) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <span className="text-text-muted text-[10px] uppercase">Velocity</span>
                    <p className={`text-xl font-semibold font-mono tabular-nums ${(prediction.pdm_strategy_analysis.price_velocity || 0) > 0 ? "text-secondary" : "text-danger"}`}>
                      {(prediction.pdm_strategy_analysis.price_velocity || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-text-muted text-xs">Recommended Stop Loss</span>
                    <span className="text-danger font-mono font-semibold text-sm tabular-nums">
                      {formatCurrency(prediction.pdm_strategy_analysis.atr_hard_stop_loss)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted text-xs">Trailing Stop</span>
                    <span className="text-neutral-600 font-mono font-semibold text-sm tabular-nums">
                      {formatCurrency(prediction.pdm_strategy_analysis.atr_trailing_stop)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Historical Chart - Full Width */}
          <motion.div variants={itemVariants} className="col-span-full card p-6 mt-4">
            <h3 className="text-lg font-semibold text-text-main mb-6 flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <LineChartIcon className="w-5 h-5 text-primary" />
              </div>
              Price Action History
            </h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={prediction?.historical_data || []}>
                  <defs>
                    <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5076EE" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#5076EE" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EAED" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#7C7E8C"
                    tick={{ fill: '#7C7E8C', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#7C7E8C"
                    tick={{ fill: '#7C7E8C', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₹${value}`}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#7C7E8C"
                    tick={{ fill: '#7C7E8C', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E8EAED",
                      borderRadius: "12px",
                      boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)",
                    }}
                    itemStyle={{ color: "#44475B" }}
                    labelStyle={{ color: "#7C7E8C", marginBottom: "0.5rem" }}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="close"
                    stroke="#5076EE"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorClose)"
                    name="Close Price"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="sma20"
                    stroke="#7C7E8C"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                    name="SMA 20"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="volume"
                    fill="#E8EAED"
                    opacity={0.5}
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
          className="flex flex-col items-center justify-center p-20 card"
        >
          <div className="bg-slate-100 p-6 rounded-full mb-6">
            <LineChartIcon className="w-12 h-12 text-text-muted" />
          </div>
          <h3 className="text-xl font-semibold text-text-main mb-2">Ready to Analyze</h3>
          <p className="text-text-muted max-w-md text-center text-sm">
            Enter a ticker symbol above to generate AI-powered price predictions and proprietary PDM strategy signals.
          </p>
        </motion.div>
      )}
    </div>
  );
};
