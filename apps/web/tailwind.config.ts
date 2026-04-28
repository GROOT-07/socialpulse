import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Colors (CSS var-backed) ──────────────────────────────
      colors: {
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          light: 'var(--color-accent-light)',
          text: 'var(--color-accent-text)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          2: 'var(--color-surface-2)',
          3: 'var(--color-surface-3)',
        },
        brand: {
          bg: 'var(--color-bg)',
          border: 'var(--color-border)',
          'border-2': 'var(--color-border-2)',
          'border-3': 'var(--color-border-3)',
        },
        // Semantic
        success: {
          DEFAULT: 'var(--color-success)',
          light: 'var(--color-success-light)',
          text: 'var(--color-success-text)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          light: 'var(--color-warning-light)',
          text: 'var(--color-warning-text)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          light: 'var(--color-danger-light)',
          text: 'var(--color-danger-text)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          light: 'var(--color-info-light)',
          text: 'var(--color-info-text)',
        },
        // Platform
        platform: {
          instagram: 'var(--platform-instagram)',
          facebook: 'var(--platform-facebook)',
          youtube: 'var(--platform-youtube)',
          whatsapp: 'var(--platform-whatsapp)',
          google: 'var(--platform-google)',
        },
        // Chart
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
          6: 'var(--chart-6)',
          neutral: 'var(--chart-neutral)',
        },
      },

      // ── Typography ───────────────────────────────────────────
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', 'monospace'],
      },

      fontSize: {
        '2xs': ['10px', { lineHeight: '1.4', letterSpacing: '0.4px', fontWeight: '500' }],
        xs:    ['12px', { lineHeight: '1.5', letterSpacing: '0.2px' }],
        sm:    ['13px', { lineHeight: '1.6' }],
        base:  ['14px', { lineHeight: '1.6' }],
        md:    ['15px', { lineHeight: '1.5' }],
        lg:    ['18px', { lineHeight: '1.4', letterSpacing: '-0.2px' }],
        xl:    ['22px', { lineHeight: '1.3', letterSpacing: '-0.3px' }],
        '2xl': ['28px', { lineHeight: '1.2', letterSpacing: '-0.4px' }],
        '3xl': ['36px', { lineHeight: '1.1', letterSpacing: '-0.5px' }],
        '4xl': ['48px', { lineHeight: '1.0', letterSpacing: '-0.8px' }],
      },

      // ── Border radius ────────────────────────────────────────
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
        full: '9999px',
      },

      // ── Shadows ──────────────────────────────────────────────
      boxShadow: {
        xs:     'var(--shadow-xs)',
        sm:     'var(--shadow-sm)',
        DEFAULT:'var(--shadow-sm)',
        md:     'var(--shadow-md)',
        lg:     'var(--shadow-lg)',
        xl:     'var(--shadow-xl)',
        accent: 'var(--shadow-accent)',
      },

      // ── Sidebar / layout constants ───────────────────────────
      width: {
        sidebar: '240px',
        'sidebar-collapsed': '56px',
      },

      height: {
        topbar: '52px',
      },

      maxWidth: {
        content: '1280px',
      },

      // ── Animations ───────────────────────────────────────────
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'slide-in-right': {
          '0%':   { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },

      animation: {
        shimmer:        'shimmer 1.5s ease-in-out infinite',
        'slide-in-right':'slide-in-right 220ms cubic-bezier(0,0,0.2,1)',
        'fade-in':      'fade-in 220ms cubic-bezier(0,0,0.2,1)',
        'scale-in':     'scale-in 220ms cubic-bezier(0,0,0.2,1)',
      },

      transitionDuration: {
        instant: '80ms',
        fast: '150ms',
        normal: '220ms',
        slow: '350ms',
        slowest: '500ms',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
