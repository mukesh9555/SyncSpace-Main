const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sync: {
          bg: '#F8FAFC', card: '#FFFFFF', primary: '#2563EB', accent: '#7C3AED',
          success: '#10B981', text: '#0F172A', 'text-secondary': '#64748B', border: '#E2E8F0',
        },
      },
      fontFamily: { sans: ['Inter', ...defaultTheme.fontFamily.sans] },
      borderRadius: { xl: '12px', '2xl': '24px' },
      boxShadow: { premium: '0 20px 25px -5px rgba(15, 23, 42, 0.04), 0 10px 10px -5px rgba(15, 23, 42, 0.02)' },
      animation: { 'float-slow': 'float 10s ease-in-out infinite', 'float-medium': 'float 8s ease-in-out infinite', 'cursor-ping': 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' },
      keyframes: { float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-20px)' } } },
    },
  },
  plugins: [],
};
