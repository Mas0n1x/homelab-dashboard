/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        glass: {
          bg: 'rgba(255, 255, 255, 0.03)',
          border: 'rgba(255, 255, 255, 0.08)',
          hover: 'rgba(255, 255, 255, 0.06)',
          active: 'rgba(255, 255, 255, 0.1)',
        },
        surface: {
          DEFAULT: 'rgba(15, 15, 35, 0.6)',
          elevated: 'rgba(25, 25, 55, 0.4)',
        },
        accent: {
          DEFAULT: 'var(--accent-color)',
          light: 'var(--accent-light)',
          dark: '#4f46e5',
          success: '#10b981',
          danger: '#ef4444',
          warning: '#f59e0b',
          info: '#3b82f6',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
          pink: '#ec4899',
        },
      },
      backdropBlur: {
        glass: '16px',
        'glass-heavy': '24px',
        'glass-light': '8px',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
      },
      boxShadow: {
        glass: '0 4px 16px rgba(0, 0, 0, 0.25), 0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        'glass-hover': '0 8px 32px rgba(0, 0, 0, 0.4), 0 16px 48px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'glass-elevated': '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        'glow-indigo': '0 0 24px rgba(99, 102, 241, 0.25), 0 0 48px rgba(99, 102, 241, 0.1)',
        'glow-emerald': '0 0 24px rgba(16, 185, 129, 0.25), 0 0 48px rgba(16, 185, 129, 0.1)',
        'glow-red': '0 0 24px rgba(239, 68, 68, 0.25), 0 0 48px rgba(239, 68, 68, 0.1)',
        'glow-cyan': '0 0 24px rgba(6, 182, 212, 0.25), 0 0 48px rgba(6, 182, 212, 0.1)',
        'glow-amber': '0 0 24px rgba(245, 158, 11, 0.25), 0 0 48px rgba(245, 158, 11, 0.1)',
        'glow-purple': '0 0 24px rgba(139, 92, 246, 0.25), 0 0 48px rgba(139, 92, 246, 0.1)',
      },
      animation: {
        'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'steam': 'steam 2s ease-out infinite',
        'steam-delay': 'steam 2s ease-out 0.5s infinite',
        'steam-delay-2': 'steam 2s ease-out 1s infinite',
        'shimmer': 'shimmer 3s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'scale-in': 'scale-in 0.3s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 6s ease infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.5)' },
        },
        'steam': {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '0.6' },
          '100%': { transform: 'translateY(-20px) scale(1.5)', opacity: '0' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(var(--accent-rgb), 0)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(var(--accent-rgb), 0.15)' },
        },
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
