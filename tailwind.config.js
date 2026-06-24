/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Anton', 'Impact', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // MIDNIGHT TAPE — charbon + signal red + signal yellow
        // Token names kept identical so existing components keep working.
        'primary-blue': '#EF4444',
        'primary-blue-hover': '#DC2626',
        'primary-blue-light': '#B91C1C',
        'dark-primary': '#0A0A0A',
        'dark-secondary': '#111111',
        'gray-medium': '#737373',
        'gray-light': '#1A1A1A',
        'gray-ultralight': '#0F0F0F',
        'success-green': '#FACC15',
        'success-green-light': '#3F2B02',
        'danger-red': '#EF4444',
        'danger-red-light': '#3F0A0A',
        'warning-yellow': '#FACC15',
        'surface-white': '#0F0F0F',
        'surface-light': '#0A0A0A',
        'surface-dark': '#000000',
        'surface-card': '#111111',
        'surface-card-hover': '#191919',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A3A3A3',
        'text-muted': '#737373',
        'border-subtle': '#262626',
        'border-accent': '#EF4444',
        'signal-red': '#EF4444',
        'signal-red-dark': '#B91C1C',
        'signal-yellow': '#FACC15',
        'signal-yellow-dark': '#CA8A04',
        'tape-charcoal': '#0A0A0A',
        'tape-ink': '#FFFFFF',
      },
      fontSize: {
        'section-title': ['0.6875rem', { lineHeight: '1rem', fontWeight: '700', letterSpacing: '0.14em' }],
        'stat-large': ['2.75rem', { lineHeight: '1', fontWeight: '800', letterSpacing: '-0.03em' }],
        'stat-medium': ['1.875rem', { lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.02em' }],
        'stat-small': ['1.125rem', { lineHeight: '1.4', fontWeight: '700' }],
        'label-regular': ['0.875rem', { lineHeight: '1.5', fontWeight: '500', letterSpacing: '0.02em' }],
        'label-small': ['0.75rem', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '0.08em' }],
        'badge': ['0.6875rem', { lineHeight: '1', fontWeight: '700', letterSpacing: '0.12em' }],
        'button': ['0.875rem', { lineHeight: '1.4', fontWeight: '700', letterSpacing: '0.04em' }],
        'body': ['0.9375rem', { lineHeight: '1.6', fontWeight: '400' }],
      },
      borderRadius: {
        'card': '0',
        'lg': '0',
        'md': '0',
        'sm': '0',
        'DEFAULT': '0',
      },
      boxShadow: {
        'card': '6px 6px 0 0 #FFFFFF',
        'card-hover': '8px 8px 0 0 #FACC15',
        'button-primary': '4px 4px 0 0 #FFFFFF',
        'button-yellow': '4px 4px 0 0 #FACC15',
        'glow-blue': '0 0 24px rgba(239, 68, 68, 0.35)',
        'tape': '8px 8px 0 0 #FFFFFF',
        'tape-red': '6px 6px 0 0 #EF4444',
      },
      transitionDuration: {
        'smooth': '180ms',
        'fast': '120ms',
      },
      keyframes: {
        fadeInUp: {
          'from': { opacity: '0', transform: 'translateY(16px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        scan: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(2px)' },
        },
      },
      animation: {
        fadeInUp: 'fadeInUp 0.35s ease-out forwards',
        scan: 'scan 6s ease-in-out infinite',
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(rgba(239,68,68,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.08) 1px, transparent 1px)',
        'tape-grain':
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 3px)',
      },
    },
  },
  plugins: [],
};
