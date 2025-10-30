/**
 * Stock Prediction Dashboard Component
 *
 * Enhanced stock prediction interface with ML models and PDM integration
 *
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Search,
  BarChart3,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
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
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["stock-prediction", selectedTicker, includePDM],
    queryFn: async () => {
      const response = await fetch("/api/predict", {
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const prediction = data?.data;

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-cyan-400 mb-4">
          Stock Price Prediction
        </h2>

        <form onSubmit={handleSubmit} className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="Enter stock ticker (e.g., AAPL, GOOGL, MSFT)"
              className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-md px-4 py-3 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={includePDM}
                onChange={(e) => setIncludePDM(e.target.checked)}
                className="rounded border-gray-600 text-cyan-600 focus:ring-cyan-500"
              />
              Include PDM Analysis
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading || !ticker.trim()}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-500 text-white font-bold py-3 px-6 rounded-md transition duration-300 flex items-center gap-2"
          >
            {isLoading ? (
              <LoadingSpinner size="small" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            {isLoading ? "Analyzing..." : "Get Prediction"}
          </button>
        </form>
      </div>

      {/* Prediction Results */}
      {prediction && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Prediction Summary */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-semibold mb-4 text-white">
                Prediction for{" "}
                <span className="text-cyan-400">
                  {prediction.ticker_symbol}
                </span>
              </h3>

              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm">Current Price</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(prediction.current_market_price)}
                  </p>
                </div>

                <div>
                  <p className="text-gray-400 text-sm">Predicted Price</p>
                  <p className="text-3xl font-bold text-cyan-400">
                    {formatCurrency(prediction.ml_predicted_price)}
                  </p>
                </div>

                <div>
                  <p className="text-gray-400 text-sm">Expected Change</p>
                  <div className="flex items-center gap-2">
                    {prediction.predicted_percentage_change > 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    )}
                    <p
                      className={`text-xl font-bold ${
                        prediction.predicted_percentage_change > 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {prediction.predicted_percentage_change > 0 ? "+" : ""}
                      {prediction.predicted_percentage_change.toFixed(2)}%
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-gray-400 text-sm">Model Accuracy</p>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-600 rounded-full">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
                        style={{
                          width: `${prediction.model_accuracy_r2_score * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-300">
                      {(prediction.model_accuracy_r2_score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {prediction.market_sentiment && (
                  <div>
                    <p className="text-gray-400 text-sm">Market Sentiment</p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          prediction.market_sentiment.label === "POSITIVE"
                            ? "bg-green-600"
                            : prediction.market_sentiment.label === "NEGATIVE"
                              ? "bg-red-600"
                              : "bg-gray-600"
                        }`}
                      >
                        {prediction.market_sentiment.label}
                      </span>
                      <span className="text-sm text-gray-300">
                        {(prediction.market_sentiment.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Technical Indicators */}
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-semibold mb-4 text-white">
                Technical Indicators
              </h3>

              <div className="space-y-3">
                {prediction.technical_indicators?.relative_strength_index && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">RSI:</span>
                    <span
                      className={`font-semibold ${
                        prediction.technical_indicators
                          .relative_strength_index > 70
                          ? "text-red-400"
                          : prediction.technical_indicators
                                .relative_strength_index < 30
                            ? "text-green-400"
                            : "text-gray-300"
                      }`}
                    >
                      {prediction.technical_indicators.relative_strength_index.toFixed(
                        1,
                      )}
                    </span>
                  </div>
                )}

                {prediction.technical_indicators?.simple_moving_average_20 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">SMA 20:</span>
                    <span className="text-gray-300 font-semibold">
                      {formatCurrency(
                        prediction.technical_indicators
                          .simple_moving_average_20,
                      )}
                    </span>
                  </div>
                )}

                {prediction.technical_indicators?.macd_line && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">MACD:</span>
                    <span
                      className={`font-semibold ${
                        prediction.technical_indicators.macd_line > 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {prediction.technical_indicators.macd_line.toFixed(2)}
                    </span>
                  </div>
                )}

                {prediction.technical_indicators?.bollinger_position && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Bollinger Position:</span>
                    <span className="text-gray-300 font-semibold">
                      {(
                        prediction.technical_indicators.bollinger_position * 100
                      ).toFixed(0)}
                      %
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* PDM Analysis */}
            {prediction.pdm_strategy_analysis && (
              <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-semibold mb-4 text-white">
                  PDM Strategy Analysis
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Signal:</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        prediction.pdm_strategy_analysis.signal_type === "LONG"
                          ? "bg-green-600"
                          : prediction.pdm_strategy_analysis.signal_type ===
                              "EXIT"
                            ? "bg-red-600"
                            : "bg-gray-600"
                      }`}
                    >
                      {prediction.pdm_strategy_analysis.signal_type}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Confidence:</span>
                    <span className="text-cyan-400 font-semibold">
                      {(
                        prediction.pdm_strategy_analysis.confidence_score * 100
                      ).toFixed(0)}
                      %
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Price Velocity:</span>
                    <span
                      className={`font-semibold ${
                        prediction.pdm_strategy_analysis.price_velocity > 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {prediction.pdm_strategy_analysis.price_velocity.toFixed(
                        2,
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Volume Factor:</span>
                    <span className="text-yellow-400 font-semibold">
                      {prediction.pdm_strategy_analysis.institutional_volume_factor.toFixed(
                        2,
                      )}
                      x
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Stop Loss:</span>
                      <span className="text-red-400">
                        {formatCurrency(
                          prediction.pdm_strategy_analysis.atr_hard_stop_loss,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Trailing Stop:</span>
                      <span className="text-orange-400">
                        {formatCurrency(
                          prediction.pdm_strategy_analysis.atr_trailing_stop,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Historical Price Chart */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg mt-6">
            <h3 className="text-xl font-semibold mb-4 text-white">
              Historical Price Chart
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={prediction.historical_data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                <XAxis dataKey="date" stroke="#A0AEC0" />
                <YAxis yAxisId="left" stroke="#A0AEC0" />
                <YAxis yAxisId="right" orientation="right" stroke="#A0AEC0" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1A202C",
                    border: "1px solid #4A5568",
                  }}
                  labelStyle={{ color: "#A0AEC0" }}
                />
                <Legend wrapperStyle={{ color: "#A0AEC0" }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="close"
                  stroke="#38B2AC"
                  name="Close"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="sma20"
                  stroke="#F6E05E"
                  name="SMA 20"
                />
                <Bar
                  yAxisId="right"
                  dataKey="volume"
                  fill="#4299E1"
                  name="Volume"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Empty State */}
      {!prediction && !isLoading && (
        <div className="bg-gray-800 p-12 rounded-lg shadow-lg text-center">
          <LineChartIcon className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            Enter a Stock Ticker to Get Started
          </h3>
          <p className="text-gray-500">
            Get AI-powered price predictions with optional PDM strategy analysis
            and historical data
          </p>
        </div>
      )}
    </div>
  );
};
