/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        // ============================================
        // RONEIRA BRAND CORE
        // ============================================
        brand: {
          charcoal: '#313131',
          offwhite: '#FDFDFC',
          'neutral-light': '#EDEDEC',
          'neutral-mid': '#ADADAD',
          'neutral-dark': '#6D6D6C',
        },
        
        // ============================================
        // DARK UI SURFACES
        // ============================================
        bg: {
          0: '#0B0B0C',     // App background (deepest)
          1: '#121214',     // Sidebar/topbar
        },
        surface: {
          1: '#17171A',     // Cards
          2: '#1E1E22',     // Hover/raised
          3: '#252528',     // Active/selected
        },
        
        // ============================================
        // TEXT HIERARCHY
        // ============================================
        text: {
          primary: '#FDFDFC',
          main: '#FDFDFC',
          secondary: 'rgba(253, 253, 252, 0.72)',
          muted: 'rgba(253, 253, 252, 0.52)',
          disabled: 'rgba(253, 253, 252, 0.36)',
        },
        
        // ============================================
        // PRIMARY ACCENT
        // ============================================
        primary: '#5A7FFF',
        'primary-light': '#7A9AFF',
        'primary-dark': '#4060D0',
        
        // ============================================
        // SEMANTIC COLORS
        // ============================================
        secondary: '#00D09C',    // Success/Bullish
        danger: '#EB5B3C',       // Error/Bearish
        warning: '#F59E0B',      // Caution/Neutral
        
        // Market colors with full scales
        bullish: {
          50: 'rgba(0, 208, 156, 0.08)',
          100: 'rgba(0, 208, 156, 0.12)',
          200: 'rgba(0, 208, 156, 0.20)',
          300: '#5BCE96',
          400: '#2EBF7A',
          500: '#00D09C',
          600: '#00B087',
          700: '#009170',
          800: '#007258',
          900: '#005341',
        },
        bearish: {
          50: 'rgba(235, 91, 60, 0.08)',
          100: 'rgba(235, 91, 60, 0.12)',
          200: 'rgba(235, 91, 60, 0.20)',
          300: '#F08571',
          400: '#EB5B3C',
          500: '#D94C2F',
          600: '#C03D23',
          700: '#A62E18',
          800: '#8C200F',
          900: '#721207',
        },
        neutral: {
          50: 'rgba(245, 158, 11, 0.08)',
          100: 'rgba(245, 158, 11, 0.12)',
          200: 'rgba(245, 158, 11, 0.20)',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        
        // Slate scale for borders and subtle elements (dark theme)
        slate: {
          50: 'rgba(253, 253, 252, 0.04)',
          100: 'rgba(253, 253, 252, 0.06)',
          200: 'rgba(253, 253, 252, 0.10)',
          300: 'rgba(253, 253, 252, 0.16)',
          400: 'rgba(253, 253, 252, 0.28)',
          500: 'rgba(253, 253, 252, 0.44)',
          600: '#6D6D6C',
          700: '#4A4A4A',
          800: '#313131',
          900: '#1A1A1A',
        },
        
        // Legacy support
        background: '#0B0B0C',
        'dark': {
          background: '#0B0B0C',
          surface: '#17171A',
          text: '#FDFDFC',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        // Groww-style soft animations
        'lift': 'lift 0.2s ease-out',
        'bounce-soft': 'bounceSoft 0.4s ease-out',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        lift: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-4px)' },
        },
        bounceSoft: {
          '0%': { transform: 'scale(0.97)' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      boxShadow: {
        // Groww-style soft shadows
        'soft': '0 4px 24px rgba(0, 0, 0, 0.04)',
        'soft-md': '0 8px 32px rgba(0, 0, 0, 0.06)',
        'soft-lg': '0 12px 48px rgba(0, 0, 0, 0.08)',
        'soft-xl': '0 20px 60px rgba(0, 0, 0, 0.10)',
        'lift': '0 8px 30px rgba(80, 118, 238, 0.15)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.08)',
        'button': '0 2px 8px rgba(80, 118, 238, 0.25)',
        'button-hover': '0 4px 16px rgba(80, 118, 238, 0.35)',
      },
      borderRadius: {
        'card': '20px',
        'btn': '50px',           // Pill shapes
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring': 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
}
