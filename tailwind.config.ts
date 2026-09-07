import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#111827',
          soft: '#374151',
          muted: '#6b7280',
          faint: '#9ca3af',
        },
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd2ff',
          300: '#8eb4ff',
          400: '#598bff',
          500: '#3563e9',
          600: '#2449c7',
          700: '#1d3aa1',
          800: '#1c3280',
          900: '#1c2e66',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-thai)',
          'Noto Sans Thai',
          'Sarabun',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)',
      },
    },
  },
  plugins: [],
};

export default config;
