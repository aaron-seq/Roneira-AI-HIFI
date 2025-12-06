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
  Newspaper,
} from "lucide-react";
import type { MarketHealthStatus } from "../../types";
import { SettingsModal } from "../settings/SettingsModal";

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
  {
    id: "news",
    label: "News",
    icon: <Newspaper className="w-5 h-5" />,
    description: "Market news & analysis",
  },
];



export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  activeTab,
  onTabChange,
  marketHealthStatus,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const getHealthStatusColor = () => {
    // ... existing logic
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
    <>
      <header className="bg-black border-b border-gold-900/50 shadow-lg relative z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded-md border border-gold-900/30">
                  <img src="/logo.jpg" alt="Roneira Logo" className="w-full h-full object-contain filter grayscale contrast-125" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-wide uppercase whitespace-nowrap">
                    Roneira <span className="text-gold-500">Enterprises AI</span>
                  </h1>
                  <p className="text-[10px] text-gold-400/80 tracking-[0.2em] uppercase mt-0.5">
                    Private Equity & Intelligence
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex space-x-2">
              {navigationTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                  flex items-center space-x-2 px-5 py-2.5 rounded transition-all duration-300 border border-transparent
                  ${activeTab === tab.id
                      ? "bg-gold-500/10 text-gold-400 border-gold-500/20 shadow-[0_0_15px_rgba(212,175,55,0.1)]"
                      : "text-gray-400 hover:text-gold-200 hover:bg-white/5"
                    }
                `}
                  title={tab.description}
                >
                  {/* Render icons in gold for active, gray for inactive */}
                  <span className={activeTab === tab.id ? "text-gold-500" : "text-gray-500 group-hover:text-gold-300"}>
                    {tab.icon}
                  </span>
                  <span className="font-medium tracking-wide text-sm">{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* System Status and Controls */}
            <div className="flex items-center space-x-6">
              {/* Health Status Indicator */}
              <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                <div
                  className={`w-2 h-2 rounded-full ${getHealthStatusColor()} shadow-[0_0_8px_currentColor]`}
                />
                <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                  {marketHealthStatus?.service_status || "Unknown"}
                </span>
              </div>

              {/* Settings Button */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-gold-500/70 hover:text-gold-400 hover:bg-gold-500/10 rounded-full transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden pb-4">
            <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
              {navigationTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                  flex items-center space-x-2 px-3 py-2 rounded whitespace-nowrap transition-all duration-200
                  ${activeTab === tab.id
                      ? "text-gold-400 bg-gold-500/10 border-b border-gold-500"
                      : "text-gray-400 hover:text-gold-300"
                    }
                `}
                >
                  <div className={activeTab === tab.id ? "text-gold-500" : "text-gray-500"}>
                    {tab.icon}
                  </div>
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};
