/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
          950: "#082f49"
        },
        neutral: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
          950: "#0a0a0a"
        },
        success: {
          50: "#f0fdf4",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d"
        },
        warning: {
          50: "#fffbeb",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309"
        },
        error: {
          50: "#fef2f2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c"
        }
      },
      screens: {
        xs: "475px",
        "3xl": "1600px",
        "4xl": "1920px"
      },
      spacing: {
        18: "4.5rem",
        88: "22rem"
      },
      animation: {
        "fade-in": "fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-in-up": "fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-in-down": "fadeInDown 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-up": "slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-down": "slideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "bounce-subtle":
          "bounceSubtle 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "pulse-subtle": "pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        fadeInDown: {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        bounceSubtle: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" }
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" }
        }
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)",
        medium:
          "0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        large:
          "0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        glow: "0 0 20px rgba(14, 165, 233, 0.15)",
        "glow-lg": "0 0 40px rgba(14, 165, 233, 0.2)"
      },
      backdropBlur: {
        xs: "2px"
      },
      borderRadius: {
        "xl": "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem"
      }
    }
  },
  plugins: []
};
