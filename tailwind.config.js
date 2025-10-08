/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tesla: {
          black: '#000000',
          'dark-gray': '#171a20',
          'medium-gray': '#393c41',
          'light-gray': '#5c5e62',
          silver: '#f4f4f4',
          white: '#ffffff',
          blue: '#3457dc',
          red: '#e82127',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        'display-xl': ['4rem', { lineHeight: '1', fontWeight: '700' }],
        'display-lg': ['3rem', { lineHeight: '1.1', fontWeight: '700' }],
        'display-md': ['2.25rem', { lineHeight: '1.2', fontWeight: '700' }],
        'display-sm': ['1.875rem', { lineHeight: '1.3', fontWeight: '700' }],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
      },
      borderRadius: {
        'tesla': '0.25rem',
        'tesla-lg': '0.5rem',
      },
      boxShadow: {
        'tesla': '0 1px 3px rgba(0,0,0,0.1)',
        'tesla-md': '0 2px 6px rgba(0,0,0,0.1)',
        'tesla-lg': '0 4px 12px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};
