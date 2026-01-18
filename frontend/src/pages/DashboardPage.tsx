import React from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3, 
  PieChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Zap
} from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { ConnectionStatus } from '../components/ui/ConnectionStatus';
import { AnimatedNumber, AnimatedPercentage } from '../components/ui/AnimatedNumber';

// Mock data for dashboard
const portfolioStats = {
  totalValue: 284750.82,
  previousValue: 278320.45,
  dayChange: 6430.37,
  dayChangePercent: 2.31,
  totalGain: 42750.82,
  totalGainPercent: 17.67,
};

const marketIndices = [
  { name: 'S&P 500', value: 5234.18, change: 0.87, trend: 'up' as const },
  { name: 'NASDAQ', value: 16742.39, change: 1.23, trend: 'up' as const },
  { name: 'DOW', value: 39127.14, change: -0.12, trend: 'down' as const },
  { name: 'VIX', value: 13.42, change: -2.34, trend: 'down' as const },
];

const topHoldings = [
  { symbol: 'AAPL', name: 'Apple Inc.', shares: 150, price: 195.50, change: 2.45, value: 29325.00 },
  { symbol: 'NVDA', name: 'NVIDIA Corp', shares: 45, price: 875.80, change: 4.12, value: 39411.00 },
  { symbol: 'MSFT', name: 'Microsoft', shares: 80, price: 420.25, change: 1.87, value: 33620.00 },
  { symbol: 'GOOGL', name: 'Alphabet Inc', shares: 100, price: 175.30, change: -0.54, value: 17530.00 },
  { symbol: 'AMZN', name: 'Amazon.com', shares: 120, price: 185.45, change: 1.23, value: 22254.00 },
];

const recentAlerts = [
  { id: 1, symbol: 'TSLA', message: 'Price crossed $270 resistance', time: '5 min ago', type: 'bullish' },
  { id: 2, symbol: 'META', message: 'RSI above 70 - overbought', time: '12 min ago', type: 'warning' },
  { id: 3, symbol: 'AAPL', message: 'New 52-week high', time: '1 hour ago', type: 'bullish' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

/**
 * Dashboard Page - Main overview with portfolio stats, market indices, and alerts
 */
export const DashboardPage: React.FC = () => {
  return (
    <motion.div
      className="min-h-screen p-6 space-y-6"
      style={{ backgroundColor: 'var(--bg-0)' }}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Page Header */}
      <motion.header 
        className="flex items-center justify-between"
        variants={itemVariants}
      >
        <div>
          <h1 
            className="text-2xl font-bold"
            style={{ color: 'var(--text-1)' }}
          >
            Dashboard
          </h1>
          <p 
            className="text-sm mt-1 flex items-center gap-2"
            style={{ color: 'var(--text-2)' }}
          >
            <Clock size={14} />
            Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>
        <ConnectionStatus status="connected" />
      </motion.header>

      {/* Portfolio Overview Cards */}
      <motion.section 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={itemVariants}
      >
        <StatCard
          title="Portfolio Value"
          value={portfolioStats.totalValue}
          previousValue={portfolioStats.previousValue}
          prefix="$"
          precision={2}
          icon={<DollarSign size={18} />}
          sparkline={{ values: [270000, 275000, 272000, 280000, 278000, 284750], color: 'bullish' }}
          size="md"
        />
        <StatCard
          title="Day's Change"
          value={portfolioStats.dayChange}
          prefix={portfolioStats.dayChange >= 0 ? '+$' : '-$'}
          precision={2}
          description={`${portfolioStats.dayChangePercent >= 0 ? '+' : ''}${portfolioStats.dayChangePercent.toFixed(2)}%`}
          icon={portfolioStats.dayChange >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          showChange={false}
          size="md"
        />
        <StatCard
          title="Total Gain"
          value={portfolioStats.totalGain}
          prefix="$"
          precision={2}
          description={`${portfolioStats.totalGainPercent >= 0 ? '+' : ''}${portfolioStats.totalGainPercent.toFixed(2)}% all time`}
          icon={<BarChart3 size={18} />}
          showChange={false}
          size="md"
        />
        <StatCard
          title="Positions"
          value={12}
          suffix=" stocks"
          precision={0}
          description="Across 5 sectors"
          icon={<PieChart size={18} />}
          showChange={false}
          size="md"
        />
      </motion.section>

      {/* Market Indices */}
      <motion.section variants={itemVariants}>
        <h2 
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--text-1)' }}
        >
          Market Indices
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {marketIndices.map((index) => (
            <motion.div
              key={index.name}
              className="p-4 rounded-xl"
              style={{ 
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border-default)'
              }}
              whileHover={{ borderColor: 'var(--border-hover)' }}
            >
              <span 
                className="text-sm font-medium"
                style={{ color: 'var(--text-2)' }}
              >
                {index.name}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <AnimatedNumber
                  value={index.value}
                  precision={2}
                  size="lg"
                  className="font-semibold"
                />
                <span 
                  className="flex items-center text-sm font-medium"
                  style={{ 
                    color: index.trend === 'up' ? 'var(--color-success)' : 'var(--color-danger)' 
                  }}
                >
                  {index.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {index.change >= 0 ? '+' : ''}{index.change}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Holdings */}
        <motion.section 
          className="lg:col-span-2"
          variants={itemVariants}
        >
          <h2 
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--text-1)' }}
          >
            Top Holdings
          </h2>
          <div 
            className="rounded-xl overflow-hidden"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)'
            }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left p-4 text-sm font-medium" style={{ color: 'var(--text-2)' }}>Symbol</th>
                  <th className="text-right p-4 text-sm font-medium" style={{ color: 'var(--text-2)' }}>Price</th>
                  <th className="text-right p-4 text-sm font-medium" style={{ color: 'var(--text-2)' }}>Change</th>
                  <th className="text-right p-4 text-sm font-medium" style={{ color: 'var(--text-2)' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {topHoldings.map((holding, idx) => (
                  <motion.tr 
                    key={holding.symbol}
                    style={{ borderBottom: idx < topHoldings.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                    whileHover={{ backgroundColor: 'var(--surface-2)' }}
                    className="transition-colors"
                  >
                    <td className="p-4">
                      <div>
                        <span className="font-medium" style={{ color: 'var(--text-1)' }}>{holding.symbol}</span>
                        <p className="text-xs" style={{ color: 'var(--text-3)' }}>{holding.name}</p>
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono" style={{ color: 'var(--text-1)' }}>
                      ${holding.price.toFixed(2)}
                    </td>
                    <td className="p-4 text-right">
                      <AnimatedPercentage 
                        value={holding.change} 
                        size="sm"
                        colorCode={true}
                      />
                    </td>
                    <td className="p-4 text-right font-mono font-medium" style={{ color: 'var(--text-1)' }}>
                      ${holding.value.toLocaleString()}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Recent Alerts */}
        <motion.section variants={itemVariants}>
          <h2 
            className="text-lg font-semibold mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-1)' }}
          >
            <Activity size={18} />
            Recent Alerts
          </h2>
          <div 
            className="rounded-xl p-4 space-y-3"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)'
            }}
          >
            {recentAlerts.map((alert) => (
              <motion.div
                key={alert.id}
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'var(--surface-2)' }}
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span 
                    className="font-medium text-sm"
                    style={{ color: 'var(--text-1)' }}
                  >
                    {alert.symbol}
                  </span>
                  <span 
                    className="text-xs"
                    style={{ color: 'var(--text-3)' }}
                  >
                    {alert.time}
                  </span>
                </div>
                <p 
                  className="text-sm flex items-center gap-1"
                  style={{ 
                    color: alert.type === 'bullish' 
                      ? 'var(--color-success)' 
                      : alert.type === 'warning' 
                        ? 'var(--color-warning)' 
                        : 'var(--text-2)'
                  }}
                >
                  <Zap size={12} />
                  {alert.message}
                </p>
              </motion.div>
            ))}
            <button
              className="w-full py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ 
                color: 'var(--color-primary)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              View All Alerts →
            </button>
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
};

export default DashboardPage;
