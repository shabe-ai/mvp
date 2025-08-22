/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Brand Colors - Exact matches from brand guide
        'accent-primary': '#f3e89a',
        'accent-primary-hover': '#efe076',
        'accent-secondary': 'transparent',
        'accent-secondary-hover': 'transparent',
        'accent-tertiary': 'transparent',
        'accent-tertiary-hover': 'transparent',
        
        // Neutral Colors
        'neutral-primary': '#ffffff',
        'neutral-secondary': '#d9d2c7',
        'neutral-inverse': '#000000',
        
        // Text Colors
        'text-primary': '#000000',
        'text-secondary': 'rgba(0, 0, 0, 0.6)',
        'text-inverse-primary': '#ffffff',
        'text-inverse-secondary': 'rgba(255, 255, 255, 0.6)',
        'text-on-accent-primary': '#000000',
        'text-on-accent-secondary': '#000000',
        'text-on-accent-tertiary': '#000000',
        'text-accent-on-primary': '#9f978d',
        'text-accent-on-primary-secondary': 'rgba(159, 151, 141, 0.6)',
        'text-accent-on-inverse': '#f3e89a',
        'text-accent-on-inverse-secondary': 'rgba(243, 232, 154, 0.6)',
        'text-on-overlay': '#ffffff',
        
        // Background Colors
        'bg-primary': '#ffffff',
        'bg-secondary': '#d9d2c7',
        'bg-accent-primary': '#f3e89a',
        'bg-accent-secondary': 'transparent',
        'bg-accent-tertiary': 'transparent',
        'bg-inverse': '#000000',
        'bg-overlay': '#000000',
        
        // Border Colors
        'border-primary': 'rgba(0, 0, 0, 0.1)',
        'border-secondary': 'rgba(0, 0, 0, 0.2)',
        'border-inverse-primary': 'rgba(255, 255, 255, 0.2)',
        'border-inverse-secondary': 'rgba(255, 255, 255, 0.1)',
        'border-accent': '#f3e89a',
        
        // Legacy support for existing components
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        // Brand guide border radius values
        'sm': '0.25rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        'round': '100rem',
        // Legacy support
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      spacing: {
        // Brand guide spacing scale
        '0.25x': '0.25rem',
        '0.5x': '0.5rem',
        '0.75x': '0.75rem',
        '1x': '1rem',
        '1.25x': '1.25rem',
        '1.5x': '1.5rem',
        '1.75x': '1.75rem',
        '2x': '2rem',
        '3x': '3rem',
      },
      fontFamily: {
        // Brand guide typography
        'heading': ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
        'body': ['Figtree', 'system-ui', 'sans-serif'],
        'button': ['Figtree', 'system-ui', 'sans-serif'],
        // Legacy support
        sans: ['Figtree', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Brand guide base font size
        'base': '1rem',
      },
      fontWeight: {
        // Brand guide font weight
        'base': '400',
      },
      lineHeight: {
        // Brand guide line height
        'base': '1.6rem',
      },
      letterSpacing: {
        // Brand guide letter spacing
        'base': '0em',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
