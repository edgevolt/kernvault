/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        white: 'rgb(var(--color-white) / <alpha-value>)',
        black: 'rgb(var(--color-black) / <alpha-value>)',
        // Full zinc scale — our entire palette
        zinc: {
          50:  'rgb(var(--color-zinc-50) / <alpha-value>)',
          100: 'rgb(var(--color-zinc-100) / <alpha-value>)',
          150: 'rgb(var(--color-zinc-150) / <alpha-value>)',
          200: 'rgb(var(--color-zinc-200) / <alpha-value>)',
          300: 'rgb(var(--color-zinc-300) / <alpha-value>)',
          400: 'rgb(var(--color-zinc-400) / <alpha-value>)',
          500: 'rgb(var(--color-zinc-500) / <alpha-value>)',
          600: 'rgb(var(--color-zinc-600) / <alpha-value>)',
          700: 'rgb(var(--color-zinc-700) / <alpha-value>)',
          800: 'rgb(var(--color-zinc-800) / <alpha-value>)',
          850: 'rgb(var(--color-zinc-850) / <alpha-value>)',
          900: 'rgb(var(--color-zinc-900) / <alpha-value>)',
          950: 'rgb(var(--color-zinc-950) / <alpha-value>)',
        },
      },
      maxWidth: {
        reading: '660px',
      },
      lineHeight: {
        reading: '1.8',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
}
