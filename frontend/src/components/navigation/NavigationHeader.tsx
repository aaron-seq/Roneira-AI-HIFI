/**
 * Navigation Header Component
 *
 * Main navigation bar for the application with tabs and health status.
 * Groww-Inspired 2026 Theme - White navbar with soft shadows.
 *
 * Author: Aaron Sequeira
 * Company: Roneira Enterprises AI
 * @version 2026 Groww Theme
 */

import React from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  PieChart,
  Activity,
  Settings,
  LayoutDashboard,
  Newspaper,
  Sparkles,
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
    label: "AI Prediction",
    icon: <Sparkles className="w-5 h-5" />,
    description: "ML-powered stock price predictions",
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
    label: "Technical",
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

  const getHealthStatusConfig = () => {
    if (!marketHealthStatus) {
      return { color: "bg-slate-400", label: "Unknown", textColor: "text-slate-500" };
    }

    switch (marketHealthStatus.service_status) {
      case "healthy":
        return { 
          color: "bg-secondary", 
          label: "Online",
          textColor: "text-secondary"
        };
      case "degraded":
        return { 
          color: "bg-neutral-500", 
          label: "Degraded",
          textColor: "text-neutral-500"
        };
      case "unhealthy":
        return { 
          color: "bg-danger", 
          label: "Offline",
          textColor: "text-danger"
        };
      default:
        return { color: "bg-slate-400", label: "Unknown", textColor: "text-slate-500" };
    }
  };

  const healthConfig = getHealthStatusConfig();

  return (
    <>
      {/* Main Header - White navbar */}
      <header className="navbar">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo and Brand */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {/* Logo - Inverted for light theme */}
                <div className="relative w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center rounded-xl overflow-hidden">
                  <img 
                    src="/roneira_enterprises_logo.png" 
                    alt="Roneira Enterprises AI Logo" 
                    className="w-full h-full object-contain logo-light"
                  />
                </div>
                
                <div className="hidden sm:block">
                  <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">
                    <span className="text-text-main">Roneira</span>
                    <span className="text-primary ml-2">AI HIFI</span>
                  </h1>
                  <p className="text-xs text-text-muted tracking-wide">
                    Financial Intelligence Platform
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Tabs - Desktop */}
            <nav className="hidden lg:flex items-center gap-1">
              {navigationTabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                    relative flex items-center gap-2 px-4 py-2.5 rounded-xl
                    transition-all duration-200 focus-ring
                    ${activeTab === tab.id
                      ? "text-primary"
                      : "text-text-muted hover:text-text-main hover:bg-slate-50"
                    }
                  `}
                  title={tab.description}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Active tab background */}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-xl bg-primary/10"
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                  
                  <span className={`relative z-10 ${activeTab === tab.id ? "text-primary" : ""}`}>
                    {tab.icon}
                  </span>
                  <span className="relative z-10 font-medium text-sm">{tab.label}</span>
                </motion.button>
              ))}
            </nav>

            {/* System Status and Controls */}
            <div className="flex items-center gap-4">
              {/* Health Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                <motion.div
                  className={`w-2 h-2 rounded-full ${healthConfig.color}`}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className={`text-xs font-medium uppercase tracking-wider hidden sm:inline ${healthConfig.textColor}`}>
                  {healthConfig.label}
                </span>
              </div>

              {/* Settings Button */}
              <motion.button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded-xl transition-colors focus-ring"
                title="Settings"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Settings className="w-5 h-5" />
              </motion.button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="lg:hidden pb-3 -mx-2">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide px-2">
              {navigationTabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap
                    transition-all duration-200 focus-ring
                    ${activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "text-text-muted hover:text-text-main hover:bg-slate-50"
                    }
                  `}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className={activeTab === tab.id ? "text-primary" : ""}>
                    {tab.icon}
                  </span>
                  <span className="text-sm font-medium">{tab.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};
