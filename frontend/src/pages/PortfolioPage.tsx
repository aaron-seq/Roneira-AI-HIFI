import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Download,
  Plus,
  ArrowUpDown
} from 'lucide-react';
import { AnimatedNumber, AnimatedPercentage } from '../components/ui/AnimatedNumber';
import { DateRangePicker, DateRange } from '../components/ui/DateRangePicker';
import { Drawer } from '../components/ui/Drawer';

// Mock portfolio data
const holdings = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', shares: 150, avgCost: 168.50, currentPrice: 195.50, value: 29325.00, gain: 4050.00, gainPercent: 16.02 },
  { symbol: 'NVDA', name: 'NVIDIA Corp', sector: 'Technology', shares: 45, avgCost: 495.00, currentPrice: 875.80, value: 39411.00, gain: 17136.00, gainPercent: 76.97 },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology', shares: 80, avgCost: 365.00, currentPrice: 420.25, value: 33620.00, gain: 4420.00, gainPercent: 15.14 },
  { symbol: 'GOOGL', name: 'Alphabet Inc', sector: 'Technology', shares: 100, avgCost: 142.00, currentPrice: 175.30, value: 17530.00, gain: 3330.00, gainPercent: 23.45 },
  { symbol: 'AMZN', name: 'Amazon.com', sector: 'Consumer', shares: 120, avgCost: 155.20, currentPrice: 185.45, value: 22254.00, gain: 3630.00, gainPercent: 19.49 },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Finance', shares: 75, avgCost: 162.50, currentPrice: 195.40, value: 14655.00, gain: 2467.50, gainPercent: 20.25 },
  { symbol: 'V', name: 'Visa Inc', sector: 'Finance', shares: 50, avgCost: 248.00, currentPrice: 275.60, value: 13780.00, gain: 1380.00, gainPercent: 11.13 },
  { symbol: 'UNH', name: 'UnitedHealth', sector: 'Healthcare', shares: 25, avgCost: 478.00, currentPrice: 525.75, value: 13143.75, gain: 1193.75, gainPercent: 9.99 },
];

const sectorAllocations = [
  { sector: 'Technology', allocation: 62.5, value: 119886.00, color: '#5A7FFF' },
  { sector: 'Consumer', allocation: 11.6, value: 22254.00, color: '#00D09C' },
  { sector: 'Finance', allocation: 14.8, value: 28435.00, color: '#F59E0B' },
  { sector: 'Healthcare', allocation: 6.9, value: 13143.75, color: '#EB5B3C' },
  { sector: 'Cash', allocation: 4.2, value: 8031.07, color: '#6D6D6C' },
];

type SortField = 'symbol' | 'value' | 'gain' | 'gainPercent';
type SortOrder = 'asc' | 'desc';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

/**
 * Portfolio Page - Holdings table, allocation charts, and performance metrics
 */
export const PortfolioPage: React.FC = () => {
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);

  const totalValue = sectorAllocations.reduce((sum, s) => sum + s.value, 0);
  const totalGain = holdings.reduce((sum, h) => sum + h.gain, 0);
  const totalCost = totalValue - totalGain;
  const totalGainPercent = (totalGain / totalCost) * 100;

  const sortedHoldings = useMemo(() => {
    const filtered = sectorFilter 
      ? holdings.filter(h => h.sector === sectorFilter)
      : holdings;
    
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const comparison = typeof aVal === 'string' 
        ? aVal.localeCompare(bVal as string)
        : (aVal as number) - (bVal as number);
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [sortField, sortOrder, sectorFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortableHeader: React.FC<{ field: SortField; label: string; align?: 'left' | 'right' }> = 
    ({ field, label, align = 'left' }) => (
      <th 
        className={`p-4 text-sm font-medium cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
        style={{ color: 'var(--text-2)' }}
        onClick={() => handleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <ArrowUpDown size={14} style={{ opacity: sortField === field ? 1 : 0.3 }} />
        </span>
      </th>
    );

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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
            Portfolio
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            {holdings.length} holdings across {new Set(holdings.map(h => h.sector)).size} sectors
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            onClick={() => setIsAddDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors"
            style={{ 
              backgroundColor: 'var(--color-primary)',
              color: 'white'
            }}
          >
            <Plus size={18} />
            Add Position
          </button>
        </div>
      </motion.header>

      {/* Summary Stats */}
      <motion.section 
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
        variants={itemVariants}
      >
        <div 
          className="p-5 rounded-xl"
          style={{ 
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border-default)'
          }}
        >
          <span className="text-sm" style={{ color: 'var(--text-2)' }}>Total Value</span>
          <div className="mt-1">
            <AnimatedNumber value={totalValue} prefix="$" size="xl" className="font-bold" />
          </div>
        </div>
        <div 
          className="p-5 rounded-xl"
          style={{ 
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border-default)'
          }}
        >
          <span className="text-sm" style={{ color: 'var(--text-2)' }}>Total Gain/Loss</span>
          <div className="mt-1 flex items-baseline gap-2">
            <AnimatedNumber 
              value={totalGain} 
              prefix={totalGain >= 0 ? '+$' : '-$'} 
              size="xl" 
              className="font-bold"
            />
            <AnimatedPercentage value={totalGainPercent} size="sm" />
          </div>
        </div>
        <div 
          className="p-5 rounded-xl"
          style={{ 
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border-default)'
          }}
        >
          <span className="text-sm" style={{ color: 'var(--text-2)' }}>Day's Change</span>
          <div className="mt-1 flex items-baseline gap-2">
            <AnimatedNumber value={6430.37} prefix="+$" size="xl" className="font-bold" />
            <span style={{ color: 'var(--color-success)' }}>+2.31%</span>
          </div>
        </div>
        <div 
          className="p-5 rounded-xl"
          style={{ 
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border-default)'
          }}
        >
          <span className="text-sm" style={{ color: 'var(--text-2)' }}>Buying Power</span>
          <div className="mt-1">
            <AnimatedNumber value={8031.07} prefix="$" size="xl" className="font-bold" />
          </div>
        </div>
      </motion.section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Holdings Table */}
        <motion.section className="lg:col-span-3" variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>
              Holdings
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={sectorFilter || ''}
                onChange={(e) => setSectorFilter(e.target.value || null)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ 
                  backgroundColor: 'var(--surface-1)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-1)'
                }}
              >
                <option value="">All Sectors</option>
                {[...new Set(holdings.map(h => h.sector))].map(sector => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
              <button
                className="p-2 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: 'var(--surface-1)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-2)'
                }}
              >
                <Download size={18} />
              </button>
            </div>
          </div>
          
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
                  <SortableHeader field="symbol" label="Symbol" />
                  <th className="text-left p-4 text-sm font-medium" style={{ color: 'var(--text-2)' }}>Shares</th>
                  <th className="text-right p-4 text-sm font-medium" style={{ color: 'var(--text-2)' }}>Avg Cost</th>
                  <th className="text-right p-4 text-sm font-medium" style={{ color: 'var(--text-2)' }}>Price</th>
                  <SortableHeader field="value" label="Value" align="right" />
                  <SortableHeader field="gainPercent" label="Gain/Loss" align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedHoldings.map((holding, idx) => (
                  <motion.tr 
                    key={holding.symbol}
                    style={{ borderBottom: idx < sortedHoldings.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                    whileHover={{ backgroundColor: 'var(--surface-2)' }}
                  >
                    <td className="p-4">
                      <div>
                        <span className="font-medium" style={{ color: 'var(--text-1)' }}>{holding.symbol}</span>
                        <p className="text-xs" style={{ color: 'var(--text-3)' }}>{holding.name}</p>
                      </div>
                    </td>
                    <td className="p-4 font-mono" style={{ color: 'var(--text-1)' }}>{holding.shares}</td>
                    <td className="p-4 text-right font-mono" style={{ color: 'var(--text-2)' }}>${holding.avgCost.toFixed(2)}</td>
                    <td className="p-4 text-right font-mono" style={{ color: 'var(--text-1)' }}>${holding.currentPrice.toFixed(2)}</td>
                    <td className="p-4 text-right font-mono font-medium" style={{ color: 'var(--text-1)' }}>
                      ${holding.value.toLocaleString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex flex-col items-end">
                        <span 
                          className="font-medium"
                          style={{ color: holding.gain >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
                        >
                          {holding.gain >= 0 ? '+' : ''}${holding.gain.toLocaleString()}
                        </span>
                        <AnimatedPercentage value={holding.gainPercent} size="sm" />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Allocation Chart */}
        <motion.section variants={itemVariants}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-1)' }}>
            Allocation
          </h2>
          <div 
            className="p-4 rounded-xl"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)'
            }}
          >
            {/* Simple Allocation Bars */}
            <div className="space-y-3">
              {sectorAllocations.map((sector) => (
                <div key={sector.sector}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--text-1)' }}>{sector.sector}</span>
                    <span style={{ color: 'var(--text-2)' }}>{sector.allocation.toFixed(1)}%</span>
                  </div>
                  <div 
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--surface-2)' }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: sector.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${sector.allocation}%` }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      </div>

      {/* Add Position Drawer */}
      <Drawer
        isOpen={isAddDrawerOpen}
        onClose={() => setIsAddDrawerOpen(false)}
        title="Add Position"
        description="Add a new stock to your portfolio"
        position="right"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-1)' }}>
              Symbol
            </label>
            <input
              type="text"
              placeholder="e.g., AAPL"
              className="w-full px-4 py-2.5 rounded-lg"
              style={{ 
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-1)'
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-1)' }}>
              Shares
            </label>
            <input
              type="number"
              placeholder="0"
              className="w-full px-4 py-2.5 rounded-lg"
              style={{ 
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-1)'
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-1)' }}>
              Average Cost
            </label>
            <input
              type="number"
              placeholder="0.00"
              className="w-full px-4 py-2.5 rounded-lg"
              style={{ 
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-1)'
              }}
            />
          </div>
          <button
            className="w-full py-3 rounded-xl font-medium mt-6"
            style={{ 
              backgroundColor: 'var(--color-primary)',
              color: 'white'
            }}
          >
            Add to Portfolio
          </button>
        </div>
      </Drawer>
    </motion.div>
  );
};

export default PortfolioPage;
