/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0a0a0f',
          secondary: '#12121a',
          tertiary: '#1a1a25',
          elevated: '#22222f',
        },
        foreground: {
          DEFAULT: '#e8e8ed',
          muted: '#9898a6',
          subtle: '#6b6b7b',
        },
        primary: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          muted: '#4f46e5',
          glow: 'rgba(99, 102, 241, 0.3)',
        },
        accent: {
          cyan: '#22d3ee',
          emerald: '#34d399',
          amber: '#fbbf24',
          rose: '#fb7185',
          violet: '#a78bfa',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          hover: 'rgba(255, 255, 255, 0.15)',
          active: 'rgba(99, 102, 241, 0.5)',
        },
        glass: {
          DEFAULT: 'rgba(18, 18, 26, 0.7)',
          light: 'rgba(255, 255, 255, 0.03)',
          border: 'rgba(255, 255, 255, 0.08)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.4)',
        glow: '0 0 20px rgba(99, 102, 241, 0.3)',
        'glow-sm': '0 0 10px rgba(99, 102, 241, 0.2)',
      },
    },
  },
  plugins: [],
};
