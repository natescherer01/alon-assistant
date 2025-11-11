/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0066FF',
        'light-gray': '#F5F5F7',
        'dark-charcoal': '#1A1A1A',
        'gradient-start': '#4040B0',
        'gradient-end': '#00D4DD',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'display': ['80px', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
        'display-mobile': ['48px', { lineHeight: '1.1', letterSpacing: '-0.03em' }],
        'title': ['48px', { lineHeight: '1.2' }],
        'title-mobile': ['36px', { lineHeight: '1.2' }],
        'subtitle': ['24px', { lineHeight: '1.4' }],
        'body': ['18px', { lineHeight: '1.6' }],
        'small': ['16px', { lineHeight: '1.5' }],
        'tiny': ['14px', { lineHeight: '1.4' }],
      },
      spacing: {
        '8': '8px',
        '16': '16px',
        '24': '24px',
        '32': '32px',
        '40': '40px',
        '48': '48px',
        '64': '64px',
        '80': '80px',
        '100': '100px',
        '120': '120px',
      },
      borderRadius: {
        'card': '24px',
        'button': '16px',
        'button-small': '8px',
      },
      boxShadow: {
        'card': '0 12px 32px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 16px 40px rgba(0, 0, 0, 0.12)',
        'button': '0 2px 8px rgba(0, 102, 255, 0.2)',
      },
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
