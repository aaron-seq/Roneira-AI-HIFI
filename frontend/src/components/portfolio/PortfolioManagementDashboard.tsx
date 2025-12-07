/**
 * Portfolio Management Dashboard Component
 *
 * Comprehensive portfolio tracking and management interface
 *
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import React, { useState, useEffect } from "react";
import { PieChart, TrendingUp, DollarSign, Plus, Trash2 } from "lucide-react";
import { fetchPortfolio, updatePortfolio } from "../../services/financialDataService";
import toast from 'react-hot-toast';

interface PortfolioItem {
  ticker: string;
  shares: number;
  avg_price: number;
}

interface PortfolioManagementDashboardProps {
  selectedTicker: string;
}

export const PortfolioManagementDashboard: React.FC<
  PortfolioManagementDashboardProps
> = ({ selectedTicker }) => {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [ticker, setTicker] = useState(selectedTicker || '');
  const [shares, setShares] = useState(1);
  const [price, setPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const userId = "demo-user"; // Hardcoded for this session

  useEffect(() => {
    loadPortfolio();
  }, []);

  useEffect(() => {
    if (selectedTicker) setTicker(selectedTicker);
  }, [selectedTicker]);

  const loadPortfolio = async () => {
    try {
      const data = await fetchPortfolio(userId);
      setPortfolio(data);
    } catch {
      toast.error("Failed to load portfolio");
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || shares <= 0 || price <= 0) return;

    setIsLoading(true);
    try {
      const updatedPortfolio = await updatePortfolio(userId, ticker.toUpperCase(), Number(shares), Number(price), 'add');
      setPortfolio(updatedPortfolio);
      toast.success(`Added ${ticker} to portfolio`);
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

  const totalValue = portfolio.reduce((sum, item) => sum + (item.shares * item.avg_price), 0);

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-cyan-400 mb-4">My Portfolio</h2>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">Total Value (Invested)</span>
            </div>
            <p className="text-2xl font-bold text-green-400">₹{totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <PieChart className="w-5 h-5 text-purple-400" />
              <span className="text-gray-400 text-sm">Positions</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">{portfolio.length}</p>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <span className="text-gray-400 text-sm">Strategy</span>
            </div>
            <p className="text-lg font-semibold text-cyan-400">Manual Entry</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Stock Form */}
          <div className="bg-gray-750 p-6 rounded-lg border border-gray-700 h-fit">
            <h3 className="text-xl font-semibold text-white mb-4">Add Position</h3>
            <form onSubmit={handleAddStock} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ticker Symbol</label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. RELIANCE"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Shares</label>
                <input
                  type="number"
                  value={shares}
                  onChange={(e) => setShares(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  min="0.01"
                  step="any"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Avg Price (₹)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  min="0.01"
                  step="any"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add to Portfolio
              </button>
            </form>
          </div>

          {/* Holdings List */}
          <div className="lg:col-span-2">
            <h3 className="text-xl font-semibold text-white mb-4">Current Holdings</h3>
            {portfolio.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-gray-900 rounded-lg">
                <p>No positions yet. Add a stock to get started.</p>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-800 text-gray-400 text-sm uppercase">
                    <tr>
                      <th className="px-6 py-3">Ticker</th>
                      <th className="px-6 py-3 text-right">Shares</th>
                      <th className="px-6 py-3 text-right">Avg Price</th>
                      <th className="px-6 py-3 text-right">Total Invested</th>
                      <th className="px-6 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {portfolio.map((item) => (
                      <tr key={item.ticker} className="hover:bg-gray-800 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{item.ticker}</td>
                        <td className="px-6 py-4 text-right text-gray-300">{item.shares}</td>
                        <td className="px-6 py-4 text-right text-gray-300">₹{item.avg_price.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-gray-300">₹{(item.shares * item.avg_price).toLocaleString()}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleRemoveStock(item.ticker)}
                            className="text-red-400 hover:text-red-300 transition-colors p-2"
                            title="Remove position"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
