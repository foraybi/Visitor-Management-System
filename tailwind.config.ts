import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'IBM Plex Sans Arabic', 'sans-serif'],
      },
      colors: {
        primary: 'rgb(0, 114, 151)',
        accent1: 'rgb(0, 166, 207)',
        accent2: 'rgb(16, 154, 169)',
        green: 'rgb(127, 188, 66)',
        blue: { DEFAULT: 'rgb(68, 114, 196)', light: 'rgb(101, 171, 194)' },
        darkBlue: { DEFAULT: 'rgb(5, 99, 193)', alt: 'rgb(5, 117, 127)' },
        border: 'rgb(231, 230, 230)',
        surface: 'rgb(248, 248, 248)',
      },
    },
  },
  plugins: [],
} satisfies Config;
