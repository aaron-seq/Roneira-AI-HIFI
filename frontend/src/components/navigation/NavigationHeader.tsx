/**
 * Navigation Header Component
 *
 * Main navigation bar for the application with tabs and health status
 *
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import React from "react";
import {
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import type { MarketHealthStatus } from "../../features/Shell/App";

interface NavigationHeaderProps {
  activeTab: string;
  onTabChange: (tabName: string) => void;
  marketHealthStatus: MarketHealthStatus | null;
}

interface NavigationTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const navigationTabs: NavigationTab[] = [
  {
    id: "overview",
    label: "Market Overview",
    icon: <LayoutDashboard className="w-5 h-5" />,
    description: "Real-time market overview and top performers",
  },
  {
    id: "prediction",
    label: "Stock Prediction",
    icon: <TrendingUp className="w-5 h-5" />,
    description: "AI-powered stock price predictions",
  },
  {
    id: "pdm-strategy",
    label: "PDM Strategy",
    icon: <Activity className="w-5 h-5" />,
    description: "Price-Volume Derivatives Momentum analysis",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: <PieChart className="w-5 h-5" />,
    description: "Portfolio management and tracking",
  },
  {
    id: "analysis",
    label: "Technical Analysis",
    icon: <BarChart3 className="w-5 h-5" />,
    description: "Comprehensive technical indicators",
  },
];

export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  activeTab,
  onTabChange,
  marketHealthStatus,
}) => {
  const getHealthStatusColor = () => {
    if (!marketHealthStatus) return "bg-gray-500";

    switch (marketHealthStatus.service_status) {
      case "healthy":
        return "bg-green-500";
      case "degraded":
        return "bg-yellow-500";
      case "unhealthy":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  Roneira AI HIFI
                </h1>
                <p className="text-xs text-gray-400">
                  High-Impact Finance Intelligence
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1">
            {navigationTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200
                  ${
                    activeTab === tab.id
                      ? "bg-cyan-600 text-white shadow-md"
                      : "text-gray-300 hover:text-white hover:bg-gray-700"
                  }
                `}
                title={tab.description}
              >
                {tab.icon}
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* System Status and Controls */}
          <div className="flex items-center space-x-4">
            {/* Health Status Indicator */}
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${getHealthStatusColor()} animate-pulse`}
              />
              <span className="text-sm text-gray-400">
                {marketHealthStatus?.service_status || "Unknown"}
              </span>
            </div>

            {/* Settings Button */}
            <button
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4">
          <div className="flex space-x-1 overflow-x-auto">
            {navigationTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  flex items-center space-x-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all duration-200
                  ${
                    activeTab === tab.id
                      ? "bg-cyan-600 text-white"
                      : "text-gray-300 hover:text-white hover:bg-gray-700"
                  }
                `}
              >
                {tab.icon}
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
