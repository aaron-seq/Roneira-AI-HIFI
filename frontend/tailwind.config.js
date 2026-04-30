/** @type {import('tailwindcss').Config} */
// Ledger Precision Design System - Material Design 3 color tokens
// Primary: Navy Blue #003d9b | Secondary: Emerald Green #006c49 | Tertiary: Crimson #8c0012
// Typography: Manrope (headlines) + Inter (body/label)
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Headline font - Manrope for impactful numbers and titles
        headline: ['Manrope', 'system-ui', 'sans-serif'],
        // Body font - Inter for readable body text and labels
        body: ['Inter', 'system-ui', 'sans-serif'],
        label: ['Inter', 'system-ui', 'sans-serif'],
        // Legacy aliases kept for backwards compatibility
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        // ==================================================
        // LEDGER PRECISION - Material Design 3 Color Tokens
        // Light surface theme - matches Ledger Precision UI
        // ==================================================

        // Primary: Navy Blue - main CTAs, active states, key numbers
        'primary':                 '#003d9b',
        'on-primary':              '#ffffff',
        'primary-container':       '#0052cc',
        'on-primary-container':    '#c4d2ff',
        'primary-fixed':           '#dae2ff',
        'primary-fixed-dim':       '#b2c5ff',
        'on-primary-fixed':        '#001848',
        'on-primary-fixed-variant':'#0040a2',
        'inverse-primary':         '#b2c5ff',
        'surface-tint':            '#0c56d0',

        // Secondary: Emerald Green - positive returns, gains, success states
        'secondary':               '#006c49',
        'on-secondary':            '#ffffff',
        'secondary-container':     '#6cf8bb',
        'on-secondary-container':  '#00714d',
        'secondary-fixed':         '#6ffbbe',
        'secondary-fixed-dim':     '#4edea3',
        'on-secondary-fixed':      '#002113',
        'on-secondary-fixed-variant':'#005236',

        // Tertiary: Crimson - losses, negative returns, alerts
        'tertiary':                '#8c0012',
        'on-tertiary':             '#ffffff',
        'tertiary-container':      '#b41521',
        'on-tertiary-container':   '#ffc5c0',
        'tertiary-fixed':          '#ffdad7',
        'tertiary-fixed-dim':      '#ffb3ad',
        'on-tertiary-fixed':       '#410004',
        'on-tertiary-fixed-variant':'#930013',

        // Error states
        'error':                   '#ba1a1a',
        'on-error':                '#ffffff',
        'error-container':         '#ffdad6',
        'on-error-container':      '#93000a',

        // Background & Surface system
        'background':              '#faf8ff',
        'on-background':           '#131b2e',
        'surface':                 '#faf8ff',
        'on-surface':              '#131b2e',
        'surface-variant':         '#dae2fd',
        'on-surface-variant':      '#434654',
        'surface-bright':          '#faf8ff',
        'surface-dim':             '#d2d9f4',
        'surface-container-lowest':'#ffffff',
        'surface-container-low':   '#f2f3ff',
        'surface-container':       '#eaedff',
        'surface-container-high':  '#e2e7ff',
        'surface-container-highest':'#dae2fd',

        // Outline
        'outline':                 '#737685',
        'outline-variant':         '#c3c6d6',

        // Inverse
        'inverse-surface':         '#283044',
        'inverse-on-surface':      '#eef0ff',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm:  '0.25rem',
        md:  '0.375rem',
        lg:  '0.5rem',
        xl:  '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      fontSize: {
        // Custom fine-grained sizes matching MD3 type scale
        '8px':  ['0.5rem',   { lineHeight: '1rem' }],
        '10px': ['0.625rem', { lineHeight: '1rem' }],
        '11px': ['0.6875rem',{ lineHeight: '1rem' }],
      },
      letterSpacing: {
        '0.2em':  '0.2em',
        '0.15em': '0.15em',
      },
      boxShadow: {
        // Elevation tokens for surface hierarchy
        'elevation-1': '0 1px 2px rgba(0,0,0,0.05)',
        'elevation-2': '0 2px 6px rgba(0,0,0,0.08)',
        'elevation-3': '0 4px 12px rgba(0,0,0,0.10)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    // Custom plugin: exposes CSS variables for the MD3 color tokens so non-Tailwind
    // CSS (e.g. lightweight-charts theme) can consume them.
    function({ addBase, theme }) {
      addBase({
        ':root': {
          '--color-primary':                 theme('colors.primary'),
          '--color-secondary':               theme('colors.secondary'),
          '--color-tertiary':                theme('colors.tertiary'),
          '--color-surface':                 theme('colors.surface'),
          '--color-surface-container':       theme('colors.surface-container'),
          '--color-on-surface':              theme('colors.on-surface'),
          '--color-on-surface-variant':      theme('colors.on-surface-variant'),
          '--color-outline':                 theme('colors.outline'),
          '--color-outline-variant':         theme('colors.outline-variant'),
        },
      });
    },
  ],
};
