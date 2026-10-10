/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FBF2DD',
        brand: { DEFAULT: '#4C5FEA', dark: '#3B4ACB' },
        success: '#3F9065',
        danger: '#D97462',
      },
      borderRadius: {
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
}
