/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutros (tema light, base "areia fria")
        canvas: "#eef1f7",
        surface: "#ffffff",
        ink: {
          DEFAULT: "#0f1729",
          soft: "#3b4763",
          muted: "#7b869e",
        },
        line: "#e2e7f0",
        // Marca Kratos — índigo/violeta
        brand: {
          50: "#eef0ff",
          100: "#e0e3ff",
          200: "#c7ccff",
          300: "#a5abff",
          400: "#8385fb",
          500: "#6a5cf0",
          600: "#5a41e0",
          700: "#4b31c2",
          800: "#3e2b9c",
          900: "#362a7c",
        },
        // Acentos por categoria de dado (paleta de dataviz)
        viz: {
          gastos: "#6a5cf0",
          contratos: "#0ea5a4",
          sancoes: "#ef5da8",
          campanhas: "#f59e0b",
          fiscal: "#3b82f6",
          servidores: "#8b5cf6",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Sora", "Inter", "sans-serif"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(30, 41, 74, 0.10)",
        "glass-lg": "0 20px 60px rgba(30, 41, 74, 0.16)",
        soft: "0 2px 8px rgba(30, 41, 74, 0.06)",
        ring: "0 0 0 1px rgba(255,255,255,0.6) inset",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(106,92,240,0.35)" },
          "70%": { boxShadow: "0 0 0 10px rgba(106,92,240,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(106,92,240,0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "fade-up": "fade-up 0.4s ease-out both",
        float: "float 6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s infinite",
      },
    },
  },
  plugins: [],
};
