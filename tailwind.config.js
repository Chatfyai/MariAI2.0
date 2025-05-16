/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-green': '#4CAF50',
        'light-green': '#8BC34A',
        'very-light-green': '#DCEDC8',
        'dark-green': '#2E7D32',
        'accent-blue': '#2196F3',
        'gray-light': '#f5f5f5',
        'gray': '#9E9E9E',
      },
      animation: {
        'gradient': 'gradient 8s ease infinite',
        'slide-row': 'slideRow 30s linear infinite',
        'slide-row-reverse': 'slideRowReverse 30s linear infinite',
        'fade-in-down': 'fadeInDown 1s ease',
        'fade-in-up': 'fadeInUp 1s ease',
        'fade-in': 'fadeIn 1s ease',
        'pulse-slow': 'pulse 2s infinite',
        'sound-wave': 'soundWave 1.2s ease-in-out infinite',
        'sound-wave-1': 'soundWave 1.2s ease-in-out infinite',
        'sound-wave-2': 'soundWave 1.2s ease-in-out infinite 0.1s',
        'sound-wave-3': 'soundWave 1.2s ease-in-out infinite 0.2s',
        'sound-wave-4': 'soundWave 1.2s ease-in-out infinite 0.3s',
        'sound-wave-5': 'soundWave 1.2s ease-in-out infinite 0.4s',
        'pulse-rings': 'pulseRings 3s ease-out infinite',
        'audio-wave': 'audioWave 1.5s ease-in-out infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
      },
      keyframes: {
        gradient: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        slideRow: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        slideRowReverse: {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeInDown: {
          'from': { opacity: '0', transform: 'translateY(-30px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          'from': { opacity: '0', transform: 'translateY(30px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        soundWave: {
          '0%, 100%': { height: '0.5rem', opacity: '0.6' },
          '50%': { height: '1.5rem', opacity: '1' },
        },
        pulseRings: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '50%': { transform: 'scale(1.1)', opacity: '0.4' },
          '100%': { transform: 'scale(0.8)', opacity: '0.8' },
        },
        audioWave: {
          '0%, 100%': { transform: 'scaleY(0.5)', opacity: '0.5' },
          '50%': { transform: 'scaleY(1)', opacity: '1' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
      },
    },
  },
  plugins: [],
} 