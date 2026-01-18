/**
 * Portfolio Management Dashboard Component
 *
 * Comprehensive portfolio tracking and management interface.
 * Groww-inspired clean design with soft aesthetics.
 *
 * Author: Aaron Sequeira
 * Company: Roneira Enterprises AI
 * Theme: Groww-Inspired 2026
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { PieChart, TrendingUp, DollarSign, Plus, Trash2, Mic, AlertCircle, Sparkles } from "lucide-react";
import { fetchPortfolio, updatePortfolio } from "../../services/financialDataService";
import toast from 'react-hot-toast';

// Import widget components
import { RadialPortfolioMeter } from "../widgets/RadialPortfolioMeter";
import { TopMoversCarousel } from "../widgets/TopMoversCarousel";
import { RiskAssessmentGauge } from "../widgets/RiskAssessmentGauge";
import { VoiceCommandButton } from "../voice/VoiceCommandButton";
import { VirtualizedTable, Column, useTableSort } from "../ui/VirtualizedTable";
import { useVoiceCommands, VoiceCommand } from "../../hooks/useVoiceCommands";
import { useGuardrails } from "../../hooks/useGuardrails";
import { speak, generateResponse } from "../../services/voiceService";

interface PortfolioItem {
  ticker: string;
  shares: number;
  avg_price: number;
  name?: string;
  current_price?: number;
  change_percent?: number;
}

interface PortfolioManagementDashboardProps {
  selectedTicker?: string;
  onTickerSelect?: (ticker: string) => void;
}

export const PortfolioManagementDashboard: React.FC<
  PortfolioManagementDashboardProps
> = ({ selectedTicker, onTickerSelect }) => {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [ticker, setTicker] = useState(selectedTicker || '');
  const [shares, setShares] = useState(1);
  const [price, setPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [previousTotalValue, setPreviousTotalValue] = useState<number | undefined>(undefined);
  const userId = "demo-user";

  // Guardrails hook
  const guardrails = useGuardrails({
    enableLogging: true,
    onViolation: (violation) => {
      console.warn('Guardrail violation:', violation);
    }
  });

  // Voice commands hook
  const {
    state: voiceState,
    transcript,
    toggleListening,
    isSupported: voiceSupported,
  } = useVoiceCommands({
    onCommand: handleVoiceCommand,
    onError: (error) => toast.error(`Voice error: ${error}`),
  });

  // Calculate derived values
  const totalValue = useMemo(() => 
    portfolio.reduce((sum, item) => sum + (item.shares * item.avg_price), 0),
    [portfolio]
  );

  const riskScore = useMemo(() => {
    if (portfolio.length === 0) return 0;
    const maxPosition = Math.max(...portfolio.map(p => p.shares * p.avg_price));
    const concentration = (maxPosition / totalValue) * 100;
    return Math.min(100, concentration + (portfolio.length < 5 ? 20 : 0));
  }, [portfolio, totalValue]);

  // Generate mock movers data
  const { gainers, losers } = useMemo(() => {
    const withChange = portfolio.map(item => ({
      ticker: item.ticker,
      name: item.name,
      price: item.current_price || item.avg_price,
      change: (item.change_percent || (Math.random() * 10 - 5)) * item.avg_price / 100,
      changePercent: item.change_percent || (Math.random() * 10 - 5),
      sparklineData: Array.from({ length: 20 }, () => 
        item.avg_price * (0.95 + Math.random() * 0.1)
      ),
    }));

    return {
      gainers: withChange.filter(m => m.changePercent >= 0).sort((a, b) => b.changePercent - a.changePercent),
      losers: withChange.filter(m => m.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent),
    };
  }, [portfolio]);

  // Table columns
  const columns: Column<PortfolioItem>[] = useMemo(() => [
    { 
      key: 'ticker', 
      header: 'Ticker', 
      width: 120, 
      sortable: true,
      render: (value) => (
        <span className="font-semibold text-text-main">{String(value)}</span>
      )
    },
    { 
      key: 'shares', 
      header: 'Shares', 
      width: 100, 
      align: 'right', 
      sortable: true,
      render: (value) => (
        <span className="text-text-secondary tabular-nums">{Number(value).toLocaleString()}</span>
      )
    },
    { 
      key: 'avg_price', 
      header: 'Avg Price', 
      width: 120, 
      align: 'right', 
      sortable: true,
      render: (value) => (
        <span className="text-text-secondary tabular-nums">₹{Number(value).toLocaleString()}</span>
      )
    },
    { 
      key: 'total', 
      header: 'Total Invested', 
      width: 140, 
      align: 'right',
      render: (_, row) => (
        <span className="text-text-main font-semibold tabular-nums">
          ₹{(row.shares * row.avg_price).toLocaleString()}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 80,
      align: 'center',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleRemoveStock(row.ticker); }}
          className="text-danger hover:text-danger/80 transition-colors p-2 rounded-lg hover:bg-bearish-50"
          title="Remove position"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )
    },
  ], []);

  const { sortedData, sortColumn, sortDirection, handleSort } = useTableSort(portfolio, 'ticker');

  useEffect(() => {
    loadPortfolio();
  }, []);

  useEffect(() => {
    if (selectedTicker) setTicker(selectedTicker);
  }, [selectedTicker]);

  const loadPortfolio = async () => {
    try {
      const data = await fetchPortfolio(userId);
      const validation = guardrails.validatePortfolio(data);
      if (validation.success) {
        setPreviousTotalValue(totalValue || undefined);
        setPortfolio(data);
      } else {
        toast.error("Invalid portfolio data received");
      }
    } catch {
      toast.error("Failed to load portfolio");
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const sanitizedTicker = guardrails.sanitizeTicker(ticker);
    if (!sanitizedTicker || !guardrails.isSharesCountValid(shares) || !guardrails.isPriceValid(price)) {
      toast.error("Invalid input values");
      return;
    }

    setIsLoading(true);
    try {
      const updatedPortfolio = await updatePortfolio(userId, sanitizedTicker, Number(shares), Number(price), 'add');
      setPortfolio(updatedPortfolio);
      toast.success(`Added ${sanitizedTicker} to portfolio`);
      setTicker('');
      setShares(1);
      setPrice(0);
    } catch {
      toast.error("Failed to add stock");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveStock = async (tickerToRemove: string) => {
    if (!confirm(`Are you sure you want to remove ${tickerToRemove}?`)) return;

    setIsLoading(true);
    try {
      const updatedPortfolio = await updatePortfolio(userId, tickerToRemove, 0, 0, 'remove');
      setPortfolio(updatedPortfolio);
      toast.success(`Removed ${tickerToRemove}`);
    } catch {
      toast.error("Failed to remove stock");
    } finally {
      setIsLoading(false);
    }
  };

  function handleVoiceCommand(command: VoiceCommand) {
    const response = generateResponse(command, { portfolioValue: totalValue });
    
    if (response.speak) {
      speak(response.text).catch(console.error);
    }

    switch (command.intent) {
      case 'show_ticker':
        if (command.entities.ticker) {
          onTickerSelect?.(command.entities.ticker);
        }
        break;
      case 'portfolio_value':
        toast.success(`Portfolio value: ₹${totalValue.toLocaleString()}`);
        break;
      case 'add_stock':
        if (command.entities.ticker && command.entities.shares) {
          setTicker(command.entities.ticker);
          setShares(command.entities.shares);
          if (command.entities.price) {
            setPrice(command.entities.price);
          }
          toast.success(`Ready to add ${command.entities.ticker}`);
        }
        break;
      default:
        break;
    }
  }

  const handleRowClick = useCallback((row: PortfolioItem) => {
    onTickerSelect?.(row.ticker);
  }, [onTickerSelect]);

  return (
    <div className="space-y-6 p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text-main">My Portfolio</h2>
          <p className="text-text-muted text-sm mt-1">Track and manage your investments</p>
        </div>
        {voiceSupported && (
          <div className="flex items-center gap-4">
            {transcript && voiceState === 'listening' && (
              <span className="text-sm text-primary animate-pulse">"{transcript}"</span>
            )}
            <VoiceCommandButton
              state={voiceState}
              onToggle={toggleListening}
              size="md"
              showLabel={false}
            />
          </div>
        )}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radial Portfolio Meter */}
        <div className="card flex items-center justify-center py-8">
          <RadialPortfolioMeter
            value={totalValue}
            previousValue={previousTotalValue}
            size="lg"
            showChange={true}
          />
        </div>

        {/* Stats Cards */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-bullish-50">
                <DollarSign className="w-5 h-5 text-secondary" />
              </div>
              <span className="text-text-muted text-sm font-medium">Total Invested</span>
            </div>
            <p className="text-2xl font-semibold text-text-main financial-value">
              ₹{totalValue.toLocaleString()}
            </p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <PieChart className="w-5 h-5 text-primary" />
              </div>
              <span className="text-text-muted text-sm font-medium">Positions</span>
            </div>
            <p className="text-2xl font-semibold text-text-main">{portfolio.length}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-secondary/10">
                <Sparkles className="w-5 h-5 text-secondary" />
              </div>
              <span className="text-text-muted text-sm font-medium">AI Strategy</span>
            </div>
            <p className="text-lg font-semibold text-secondary">PDM Active</p>
          </div>
        </div>

        {/* Risk Assessment Gauge */}
        <div className="card flex items-center justify-center py-8">
          <RiskAssessmentGauge
            riskScore={riskScore}
            size="md"
            showTooltip={true}
          />
        </div>
      </div>

      {/* Top Movers Carousel */}
      {portfolio.length > 0 && (
        <TopMoversCarousel
          gainers={gainers}
          losers={losers}
          autoScroll={true}
          autoScrollInterval={5000}
          onItemClick={(ticker) => onTickerSelect?.(ticker)}
        />
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add Stock Form */}
        <div className="card h-fit">
          <h3 className="text-lg font-semibold text-text-main mb-4 flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            Add Position
          </h3>
          <form onSubmit={handleAddStock} className="space-y-4">
            <div>
              <label className="block text-sm text-text-muted mb-1 font-medium">Ticker Symbol</label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="input"
                placeholder="e.g. RELIANCE"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1 font-medium">Shares</label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(Number(e.target.value))}
                className="input"
                min="0.01"
                step="any"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1 font-medium">Avg Price (₹)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="input"
                min="0.01"
                step="any"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              <Plus className="w-4 h-4" /> Add to Portfolio
            </button>
          </form>

          {/* Voice command hint */}
          {voiceSupported && (
            <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-xs text-primary flex items-center gap-2">
                <Mic className="w-3 h-3" />
                Try: "Add 10 shares of AAPL"
              </p>
            </div>
          )}
        </div>

        {/* Holdings Table */}
        <div className="lg:col-span-2">
          <h3 className="text-lg font-semibold text-text-main mb-4">Current Holdings</h3>
          {portfolio.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto mb-4 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-text-muted" />
              </div>
              <p className="text-text-muted">No positions yet. Add a stock to get started.</p>
            </div>
          ) : (
            <VirtualizedTable
              data={sortedData}
              columns={columns}
              rowHeight={56}
              maxHeight={400}
              onRowClick={handleRowClick}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              stickyHeader={true}
              loading={isLoading}
            />
          )}
        </div>
      </div>

      {/* Guardrails violation indicator */}
      {guardrails.lastValidationError && (
        <div className="fixed bottom-4 right-4 p-4 rounded-xl bg-bearish-50 border border-danger/20 text-danger shadow-soft">
          <p className="text-sm">{guardrails.lastValidationError}</p>
        </div>
      )}
    </div>
  );
};

export default PortfolioManagementDashboard;
