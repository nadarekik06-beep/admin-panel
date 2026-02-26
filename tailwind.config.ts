import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Design system — matches dark dashboard from screenshots
        bg: {
          primary:   '#0f1117',
          secondary: '#1a1d27',
          card:      '#1e2130',
          hover:     '#252840',
        },
        accent: {
          purple: '#7c3aed',
          'purple-light': '#a78bfa',
          cyan:   '#06b6d4',
          green:  '#10b981',
          orange: '#f59e0b',
          red:    '#ef4444',
          pink:   '#ec4899',
        },
        border: {
          DEFAULT: '#2a2d3e',
          light:   '#3a3d52',
        },
        text: {
          primary:   '#f1f5f9',
          secondary: '#94a3b8',
          muted:     '#64748b',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      backgroundImage: {
        'gradient-card': 'linear-gradient(135deg, #1e2130 0%, #252840 100%)',
        'gradient-purple': 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
        'gradient-cyan': 'linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)',
        'gradient-green': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'gradient-orange': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.3)',
        glow: '0 0 20px rgba(124, 58, 237, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config