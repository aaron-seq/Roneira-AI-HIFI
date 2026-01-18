import React from 'react';
import { motion } from 'framer-motion';

/**
 * ThemePreview - Design System Showcase
 * Displays all Roneira design tokens: colors, typography, spacing, shadows, and motion
 */
export const ThemePreview: React.FC = () => {
  const colorSections = [
    {
      title: 'Brand Core',
      colors: [
        { name: 'Charcoal', value: '#313131', var: '--brand-charcoal' },
        { name: 'Off-White', value: '#FDFDFC', var: '--brand-offwhite', dark: true },
        { name: 'Neutral Light', value: '#EDEDEC', var: '--brand-neutral-light', dark: true },
        { name: 'Neutral Mid', value: '#ADADAD', var: '--brand-neutral-mid' },
        { name: 'Neutral Dark', value: '#6D6D6C', var: '--brand-neutral-dark' },
      ],
    },
    {
      title: 'Surfaces',
      colors: [
        { name: 'BG-0 (App)', value: '#0B0B0C', var: '--bg-0' },
        { name: 'BG-1 (Sidebar)', value: '#121214', var: '--bg-1' },
        { name: 'Surface-1 (Cards)', value: '#17171A', var: '--surface-1' },
        { name: 'Surface-2 (Hover)', value: '#1E1E22', var: '--surface-2' },
        { name: 'Surface-3 (Active)', value: '#252528', var: '--surface-3' },
      ],
    },
    {
      title: 'Semantic',
      colors: [
        { name: 'Primary', value: '#5A7FFF', var: '--color-primary' },
        { name: 'Success/Bullish', value: '#00D09C', var: '--color-success' },
        { name: 'Danger/Bearish', value: '#EB5B3C', var: '--color-danger' },
        { name: 'Warning', value: '#F59E0B', var: '--color-warning' },
      ],
    },
  ];

  const textSamples = [
    { name: 'Text-1 (Primary)', className: 'text-text-primary', style: { color: 'var(--text-1)' } },
    { name: 'Text-2 (Secondary)', className: 'text-text-secondary', style: { color: 'var(--text-2)' } },
    { name: 'Text-3 (Muted)', className: 'text-text-muted', style: { color: 'var(--text-3)' } },
    { name: 'Text-4 (Disabled)', className: 'text-text-disabled', style: { color: 'var(--text-4)' } },
  ];

  const spacingScale = [
    { name: 'XS', value: '4px', tw: 'space-xs' },
    { name: 'SM', value: '8px', tw: 'space-sm' },
    { name: 'MD', value: '16px', tw: 'space-md' },
    { name: 'LG', value: '24px', tw: 'space-lg' },
    { name: 'XL', value: '32px', tw: 'space-xl' },
    { name: '2XL', value: '48px', tw: 'space-2xl' },
  ];

  const radiusScale = [
    { name: 'XS', value: '4px' },
    { name: 'SM', value: '8px' },
    { name: 'MD', value: '12px' },
    { name: 'LG', value: '16px' },
    { name: 'XL', value: '20px' },
    { name: '2XL', value: '24px' },
    { name: 'Pill', value: '50px' },
  ];

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--bg-0)', color: 'var(--text-1)' }}>
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <header className="text-center mb-12">
          <motion.h1 
            className="text-4xl font-bold mb-2"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Roneira Design System
          </motion.h1>
          <p style={{ color: 'var(--text-2)' }}>
            Premium Dark Theme • Grey/White/Black Palette
          </p>
        </header>

        {/* Color Palette */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Color Palette</h2>
          {colorSections.map((section) => (
            <div key={section.title} className="mb-8">
              <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-2)' }}>
                {section.title}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {section.colors.map((color) => (
                  <motion.div
                    key={color.name}
                    className="rounded-xl overflow-hidden"
                    style={{ 
                      backgroundColor: 'var(--surface-1)',
                      border: '1px solid var(--border-default)'
                    }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div 
                      className="h-20 w-full"
                      style={{ backgroundColor: color.value }}
                    />
                    <div className="p-3">
                      <p className="font-medium text-sm">{color.name}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
                        {color.value}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Typography */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Typography</h2>
          <div 
            className="rounded-xl p-6"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)'
            }}
          >
            <div className="space-y-4 mb-8">
              <p className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
                font-family: 'Inter', system-ui, sans-serif
              </p>
              <h1 className="text-3xl font-bold">Heading 1 - Bold 1.75rem</h1>
              <h2 className="text-2xl font-semibold">Heading 2 - Semibold 1.375rem</h2>
              <h3 className="text-xl font-medium">Heading 3 - Medium 1.125rem</h3>
              <p className="text-base">Body - Regular 1rem</p>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>Small - 0.875rem</p>
            </div>
            
            <h3 className="text-lg font-medium mb-4">Text Hierarchy</h3>
            <div className="space-y-2">
              {textSamples.map((sample) => (
                <div key={sample.name} className="flex items-center gap-4">
                  <span 
                    className="text-base font-medium"
                    style={sample.style}
                  >
                    {sample.name}
                  </span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-4)' }}>
                    {sample.className}
                  </span>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-medium mt-8 mb-4">Tabular Numbers</h3>
            <div className="font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <p className="text-2xl">$1,234,567.89</p>
              <p className="text-2xl">$9,876,543.21</p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-3)' }}>
                font-variant-numeric: tabular-nums
              </p>
            </div>
          </div>
        </section>

        {/* Spacing */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Spacing Scale</h2>
          <div 
            className="rounded-xl p-6"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)'
            }}
          >
            <div className="flex items-end gap-4 flex-wrap">
              {spacingScale.map((space) => (
                <div key={space.name} className="text-center">
                  <div 
                    className="mb-2"
                    style={{ 
                      width: space.value, 
                      height: space.value,
                      backgroundColor: 'var(--color-primary)',
                      borderRadius: '4px'
                    }}
                  />
                  <p className="text-xs font-medium">{space.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>{space.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Border Radius */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Border Radius</h2>
          <div 
            className="rounded-xl p-6"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)'
            }}
          >
            <div className="flex items-center gap-4 flex-wrap">
              {radiusScale.map((radius) => (
                <div key={radius.name} className="text-center">
                  <div 
                    className="w-16 h-16 mb-2"
                    style={{ 
                      backgroundColor: 'var(--surface-2)',
                      borderRadius: radius.value,
                      border: '2px solid var(--color-primary)'
                    }}
                  />
                  <p className="text-xs font-medium">{radius.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>{radius.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Shadows */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Shadows</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Card', style: 'var(--shadow-card)' },
              { name: 'Card Hover', style: 'var(--shadow-card-hover)' },
              { name: 'Glow', style: 'var(--shadow-glow)' },
            ].map((shadow) => (
              <div 
                key={shadow.name}
                className="p-6 rounded-xl text-center"
                style={{ 
                  backgroundColor: 'var(--surface-1)',
                  boxShadow: shadow.style
                }}
              >
                <p className="font-medium">{shadow.name}</p>
                <p className="text-xs font-mono mt-2" style={{ color: 'var(--text-3)' }}>
                  {shadow.style.replace('var(--', '').replace(')', '')}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Motion */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Motion & Transitions</h2>
          <div 
            className="rounded-xl p-6"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)'
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <motion.div
                  className="w-16 h-16 mx-auto rounded-lg mb-4"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.12 }}
                />
                <p className="font-medium">Fast (120ms)</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Hover states</p>
              </div>
              <div className="text-center">
                <motion.div
                  className="w-16 h-16 mx-auto rounded-lg mb-4"
                  style={{ backgroundColor: 'var(--color-success)' }}
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                />
                <p className="font-medium">Normal (200ms)</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Standard motion</p>
              </div>
              <div className="text-center">
                <motion.div
                  className="w-16 h-16 mx-auto rounded-lg mb-4"
                  style={{ backgroundColor: 'var(--color-danger)' }}
                  whileHover={{ rotate: 10 }}
                  transition={{ duration: 0.32, ease: [0.68, -0.55, 0.27, 1.55] }}
                />
                <p className="font-medium">Spring</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Playful elements</p>
              </div>
            </div>
          </div>
        </section>

        {/* Components Preview */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Component Samples</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Buttons */}
            <div 
              className="rounded-xl p-6"
              style={{ 
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border-default)'
              }}
            >
              <h3 className="font-medium mb-4">Buttons</h3>
              <div className="flex flex-wrap gap-3">
                <button className="btn-primary">Primary</button>
                <button className="btn-secondary">Secondary</button>
                <button className="btn-outline">Outline</button>
                <button className="btn-ghost">Ghost</button>
              </div>
            </div>

            {/* Badges */}
            <div 
              className="rounded-xl p-6"
              style={{ 
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border-default)'
              }}
            >
              <h3 className="font-medium mb-4">Badges</h3>
              <div className="flex flex-wrap gap-3">
                <span className="badge-success">+2.45%</span>
                <span className="badge-danger">-1.23%</span>
                <span className="badge-neutral">Pending</span>
                <span className="badge-primary">New</span>
              </div>
            </div>

            {/* Cards */}
            <div 
              className="rounded-xl p-6"
              style={{ 
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border-default)'
              }}
            >
              <h3 className="font-medium mb-4">Card Styles</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="card p-4">
                  <p className="text-sm">Default Card</p>
                </div>
                <div className="card-elevated p-4">
                  <p className="text-sm">Elevated</p>
                </div>
              </div>
            </div>

            {/* Status Indicators */}
            <div 
              className="rounded-xl p-6"
              style={{ 
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border-default)'
              }}
            >
              <h3 className="font-medium mb-4">Status Indicators</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="status-online" />
                  <span className="text-sm">Connected</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="status-warning" />
                  <span className="text-sm">Reconnecting</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="status-offline" />
                  <span className="text-sm">Offline</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center pt-8 pb-4" style={{ color: 'var(--text-3)' }}>
          <p className="text-sm">
            Roneira Enterprises AI • Design System v2.0
          </p>
        </footer>
      </div>
    </div>
  );
};

export default ThemePreview;
