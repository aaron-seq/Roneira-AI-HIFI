import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  Target,
  HelpCircle,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';

// Horizon options
const horizons = [
  { value: '1d', label: '1 Day' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

// Mock prediction result
interface PredictionResult {
  symbol: string;
  currentPrice: number;
  predictedPrice: number;
  predictedChange: number;
  predictedChangePercent: number;
  confidence: number;
  horizon: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  factors: { name: string; impact: number; direction: 'positive' | 'negative' }[];
  timestamp: Date;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

/**
 * Predictions Page - ML model predictions with confidence and horizon selection
 */
export const PredictionsPage: React.FC = () => {
  const [symbol, setSymbol] = useState('');
  const [horizon, setHorizon] = useState('7d');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePredict = async () => {
    if (!symbol) {
      setError('Please enter a symbol');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock result
    const currentPrice = 100 + Math.random() * 200;
    const predictedChange = (Math.random() - 0.3) * 20;
    const predictedPrice = currentPrice + predictedChange;
    
    setResult({
      symbol: symbol.toUpperCase(),
      currentPrice,
      predictedPrice,
      predictedChange,
      predictedChangePercent: (predictedChange / currentPrice) * 100,
      confidence: 65 + Math.random() * 25,
      horizon,
      direction: predictedChange > 2 ? 'bullish' : predictedChange < -2 ? 'bearish' : 'neutral',
      factors: [
        { name: 'Technical Momentum', impact: 0.35, direction: predictedChange > 0 ? 'positive' : 'negative' },
        { name: 'Sentiment Score', impact: 0.25, direction: 'positive' },
        { name: 'Volume Trend', impact: 0.20, direction: predictedChange > 0 ? 'positive' : 'negative' },
        { name: 'Sector Performance', impact: 0.12, direction: 'positive' },
        { name: 'Macro Factors', impact: 0.08, direction: 'negative' },
      ],
      timestamp: new Date(),
    });

    setIsLoading(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'var(--color-success)';
    if (confidence >= 60) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  return (
    <motion.div
      className="min-h-screen p-6 space-y-6"
      style={{ backgroundColor: 'var(--bg-0)' }}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Page Header */}
      <motion.header variants={itemVariants}>
        <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--text-1)' }}>
          <Brain size={28} />
          AI Predictions
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
          ML-powered stock price predictions with confidence scores
        </p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prediction Form */}
        <motion.section variants={itemVariants}>
          <div 
            className="p-6 rounded-xl"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)'
            }}
          >
            <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-1)' }}>
              Get Prediction
            </h2>

            <div className="space-y-5">
              {/* Symbol Input */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-1)' }}>
                  Stock Symbol
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g., AAPL, TSLA, NVDA"
                  className="w-full px-4 py-3 rounded-xl uppercase"
                  style={{ 
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-1)'
                  }}
                />
              </div>

              {/* Horizon Selection */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-1)' }}>
                  Prediction Horizon
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {horizons.map((h) => (
                    <button
                      key={h.value}
                      onClick={() => setHorizon(h.value)}
                      className="py-2.5 rounded-lg text-sm font-medium transition-colors"
                      style={{ 
                        backgroundColor: horizon === h.value ? 'var(--color-primary)' : 'var(--surface-2)',
                        color: horizon === h.value ? 'white' : 'var(--text-1)',
                        border: '1px solid var(--border-default)'
                      }}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div 
                  className="flex items-center gap-2 p-3 rounded-lg"
                  style={{ 
                    backgroundColor: 'var(--color-danger-bg)',
                    color: 'var(--color-danger)'
                  }}
                >
                  <AlertTriangle size={16} />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handlePredict}
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                style={{ 
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  opacity: isLoading ? 0.7 : 1
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain size={18} />
                    Generate Prediction
                  </>
                )}
              </button>
            </div>
          </div>

          {/* How It Works */}
          <div 
            className="mt-4 p-4 rounded-xl"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)'
            }}
          >
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
              <HelpCircle size={16} />
              How It Works
            </h3>
            <ul className="space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
              <li className="flex items-start gap-2">
                <span style={{ color: 'var(--color-primary)' }}>1.</span>
                Our ML models analyze technical indicators, sentiment, and market data
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: 'var(--color-primary)' }}>2.</span>
                Multiple models vote on direction and magnitude
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: 'var(--color-primary)' }}>3.</span>
                Confidence score reflects model agreement and data quality
              </li>
            </ul>
          </div>
        </motion.section>

        {/* Prediction Result */}
        <motion.section variants={itemVariants}>
          {result ? (
            <div 
              className="p-6 rounded-xl"
              style={{ 
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border-default)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
                    {result.symbol}
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                    {horizons.find(h => h.value === result.horizon)?.label} prediction
                  </p>
                </div>
                <div 
                  className="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1"
                  style={{ 
                    backgroundColor: result.direction === 'bullish' 
                      ? 'var(--color-success-bg)' 
                      : result.direction === 'bearish' 
                        ? 'var(--color-danger-bg)' 
                        : 'var(--surface-2)',
                    color: result.direction === 'bullish' 
                      ? 'var(--color-success)' 
                      : result.direction === 'bearish' 
                        ? 'var(--color-danger)' 
                        : 'var(--text-2)'
                  }}
                >
                  {result.direction === 'bullish' ? <TrendingUp size={14} /> : 
                   result.direction === 'bearish' ? <TrendingDown size={14} /> : null}
                  {result.direction.charAt(0).toUpperCase() + result.direction.slice(1)}
                </div>
              </div>

              {/* Price Prediction */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <span className="text-sm" style={{ color: 'var(--text-2)' }}>Current Price</span>
                  <div className="mt-1">
                    <AnimatedNumber value={result.currentPrice} prefix="$" size="xl" className="font-bold" />
                  </div>
                </div>
                <div>
                  <span className="text-sm" style={{ color: 'var(--text-2)' }}>Predicted Price</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <AnimatedNumber 
                      value={result.predictedPrice} 
                      prefix="$" 
                      size="xl" 
                      className="font-bold"
                    />
                    <span 
                      className="text-sm font-medium"
                      style={{ 
                        color: result.predictedChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                      }}
                    >
                      ({result.predictedChange >= 0 ? '+' : ''}{result.predictedChangePercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Confidence Meter */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span style={{ color: 'var(--text-2)' }}>Confidence Score</span>
                  <span 
                    className="font-medium"
                    style={{ color: getConfidenceColor(result.confidence) }}
                  >
                    {result.confidence.toFixed(1)}%
                  </span>
                </div>
                <div 
                  className="h-3 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--surface-2)' }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: getConfidenceColor(result.confidence) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${result.confidence}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Key Factors */}
              <div>
                <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-1)' }}>
                  Key Factors
                </h3>
                <div className="space-y-2">
                  {result.factors.map((factor) => (
                    <div 
                      key={factor.name}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ backgroundColor: 'var(--surface-2)' }}
                    >
                      <span className="text-sm" style={{ color: 'var(--text-1)' }}>{factor.name}</span>
                      <span 
                        className="text-sm font-medium"
                        style={{ 
                          color: factor.direction === 'positive' ? 'var(--color-success)' : 'var(--color-danger)' 
                        }}
                      >
                        {factor.direction === 'positive' ? '+' : '-'}{(factor.impact * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timestamp */}
              <p className="text-xs mt-4 text-center" style={{ color: 'var(--text-3)' }}>
                Generated at {result.timestamp.toLocaleString()}
              </p>
            </div>
          ) : (
            <div 
              className="h-full flex flex-col items-center justify-center p-12 rounded-xl"
              style={{ 
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border-default)'
              }}
            >
              <Target size={64} className="mb-4" style={{ color: 'var(--text-3)' }} />
              <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-1)' }}>
                No prediction yet
              </h3>
              <p className="text-center" style={{ color: 'var(--text-2)' }}>
                Enter a stock symbol and select a horizon to get an AI-powered price prediction
              </p>
            </div>
          )}
        </motion.section>
      </div>
    </motion.div>
  );
};

export default PredictionsPage;
