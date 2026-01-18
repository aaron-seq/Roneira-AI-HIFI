import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Key, 
  RefreshCw, 
  Palette, 
  Bell, 
  Shield,
  Database,
  Save,
  Eye,
  EyeOff,
  Check
} from 'lucide-react';

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const sections: SettingsSection[] = [
  { id: 'api', label: 'API Configuration', icon: <Key size={18} /> },
  { id: 'refresh', label: 'Data Refresh', icon: <RefreshCw size={18} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={18} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
  { id: 'privacy', label: 'Privacy & Security', icon: <Shield size={18} /> },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

/**
 * Settings Page - API keys, refresh intervals, theme, and notification preferences
 */
export const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('api');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Form state
  const [settings, setSettings] = useState({
    alphaVantageKey: '',
    newsApiKey: '',
    refreshInterval: '30',
    theme: 'dark',
    density: 'comfortable',
    priceAlerts: true,
    newsAlerts: true,
    portfolioAlerts: true,
    emailNotifications: false,
    twoFactor: false,
    dataRetention: '90',
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateSetting = (key: keyof typeof settings, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'api':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-1)' }}>
                Alpha Vantage API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.alphaVantageKey}
                  onChange={(e) => updateSetting('alphaVantageKey', e.target.value)}
                  placeholder="Enter your API key"
                  className="w-full px-4 py-3 pr-12 rounded-xl"
                  style={{ 
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-1)'
                  }}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: 'var(--text-2)' }}
                >
                  {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
                Get a free API key from <a href="https://www.alphavantage.co/" target="_blank" 
                  style={{ color: 'var(--color-primary)' }}>alphavantage.co</a>
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-1)' }}>
                News API Key
              </label>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={settings.newsApiKey}
                onChange={(e) => updateSetting('newsApiKey', e.target.value)}
                placeholder="Enter your API key"
                className="w-full px-4 py-3 rounded-xl"
                style={{ 
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-1)'
                }}
              />
            </div>
          </div>
        );

      case 'refresh':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-1)' }}>
                Auto-refresh Interval
              </label>
              <select
                value={settings.refreshInterval}
                onChange={(e) => updateSetting('refreshInterval', e.target.value)}
                className="w-full px-4 py-3 rounded-xl"
                style={{ 
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-1)'
                }}
              >
                <option value="10">Every 10 seconds</option>
                <option value="30">Every 30 seconds</option>
                <option value="60">Every 1 minute</option>
                <option value="300">Every 5 minutes</option>
                <option value="0">Manual only</option>
              </select>
            </div>
            
            <div 
              className="p-4 rounded-xl"
              style={{ backgroundColor: 'var(--surface-2)' }}
            >
              <div className="flex items-center gap-3">
                <Database size={20} style={{ color: 'var(--color-primary)' }} />
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-1)' }}>WebSocket Connection</p>
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                    Real-time data uses WebSocket with 10-second aggregation
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-1)' }}>
                Theme
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['dark', 'light'].map((theme) => (
                  <button
                    key={theme}
                    onClick={() => updateSetting('theme', theme)}
                    className="p-4 rounded-xl text-left transition-colors"
                    style={{ 
                      backgroundColor: settings.theme === theme ? 'var(--color-primary)' : 'var(--surface-2)',
                      color: settings.theme === theme ? 'white' : 'var(--text-1)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    <span className="font-medium capitalize">{theme}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-1)' }}>
                UI Density
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['compact', 'comfortable', 'spacious'].map((density) => (
                  <button
                    key={density}
                    onClick={() => updateSetting('density', density)}
                    className="py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
                    style={{ 
                      backgroundColor: settings.density === density ? 'var(--color-primary)' : 'var(--surface-2)',
                      color: settings.density === density ? 'white' : 'var(--text-1)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    {density.charAt(0).toUpperCase() + density.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-4">
            {[
              { key: 'priceAlerts' as const, label: 'Price Alerts', desc: 'Get notified when stocks hit target prices' },
              { key: 'newsAlerts' as const, label: 'News Alerts', desc: 'Important news about your watchlist' },
              { key: 'portfolioAlerts' as const, label: 'Portfolio Alerts', desc: 'Daily P&L and significant changes' },
              { key: 'emailNotifications' as const, label: 'Email Notifications', desc: 'Receive alerts via email' },
            ].map((item) => (
              <div 
                key={item.key}
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ backgroundColor: 'var(--surface-2)' }}
              >
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-1)' }}>{item.label}</p>
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>{item.desc}</p>
                </div>
                <button
                  onClick={() => updateSetting(item.key, !settings[item.key])}
                  className="w-12 h-7 rounded-full relative transition-colors"
                  style={{ 
                    backgroundColor: settings[item.key] ? 'var(--color-primary)' : 'var(--surface-1)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  <motion.div
                    className="w-5 h-5 rounded-full absolute top-0.5"
                    style={{ backgroundColor: 'white' }}
                    animate={{ left: settings[item.key] ? '26px' : '2px' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>
            ))}
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-6">
            <div 
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ backgroundColor: 'var(--surface-2)' }}
            >
              <div>
                <p className="font-medium" style={{ color: 'var(--text-1)' }}>Two-Factor Authentication</p>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>Add extra security to your account</p>
              </div>
              <button
                onClick={() => updateSetting('twoFactor', !settings.twoFactor)}
                className="w-12 h-7 rounded-full relative transition-colors"
                style={{ 
                  backgroundColor: settings.twoFactor ? 'var(--color-primary)' : 'var(--surface-1)',
                  border: '1px solid var(--border-default)'
                }}
              >
                <motion.div
                  className="w-5 h-5 rounded-full absolute top-0.5"
                  style={{ backgroundColor: 'white' }}
                  animate={{ left: settings.twoFactor ? '26px' : '2px' }}
                />
              </button>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-1)' }}>
                Data Retention Period
              </label>
              <select
                value={settings.dataRetention}
                onChange={(e) => updateSetting('dataRetention', e.target.value)}
                className="w-full px-4 py-3 rounded-xl"
                style={{ 
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-1)'
                }}
              >
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
                <option value="0">Keep forever</option>
              </select>
            </div>
          </div>
        );
    }
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
      <motion.header 
        className="flex items-center justify-between"
        variants={itemVariants}
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--text-1)' }}>
            <Settings size={28} />
            Settings
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            Manage your preferences and account settings
          </p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors"
          style={{ 
            backgroundColor: saved ? 'var(--color-success)' : 'var(--color-primary)',
            color: 'white'
          }}
        >
          {saved ? <Check size={18} /> : <Save size={18} />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <motion.nav variants={itemVariants}>
          <div 
            className="rounded-xl overflow-hidden"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)'
            }}
          >
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                style={{ 
                  backgroundColor: activeSection === section.id ? 'var(--surface-2)' : 'transparent',
                  color: activeSection === section.id ? 'var(--text-1)' : 'var(--text-2)',
                  borderLeft: activeSection === section.id ? '3px solid var(--color-primary)' : '3px solid transparent'
                }}
              >
                {section.icon}
                <span className="font-medium">{section.label}</span>
              </button>
            ))}
          </div>
        </motion.nav>

        {/* Settings Content */}
        <motion.section 
          className="lg:col-span-3"
          variants={itemVariants}
        >
          <div 
            className="p-6 rounded-xl"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)'
            }}
          >
            <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-1)' }}>
              {sections.find(s => s.id === activeSection)?.label}
            </h2>
            {renderSection()}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
};

export default SettingsPage;
