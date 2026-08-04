import type { Config } from "tailwindcss";

const config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#0a0a0f",
          secondary: "#12121a",
          tertiary: "#1a1a25",
          elevated: "#22222f",
        },
        foreground: {
          DEFAULT: "#e8e8ed",
          muted: "#9898a6",
          subtle: "#6b6b7b",
        },
        primary: {
          DEFAULT: "#6366f1",
          hover: "#818cf8",
          muted: "#4f46e5",
          glow: "rgba(99, 102, 241, 0.3)",
        },
        accent: {
          cyan: "#22d3ee",
          emerald: "#34d399",
          amber: "#fbbf24",
          rose: "#fb7185",
          violet: "#a78bfa",
        },
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          hover: "rgba(255, 255, 255, 0.15)",
          active: "rgba(99, 102, 241, 0.5)",
        },
        glass: {
          DEFAULT: "rgba(18, 18, 26, 0.7)",
          light: "rgba(255, 255, 255, 0.03)",
          border: "rgba(255, 255, 255, 0.08)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.4)",
        glow: "0 0 20px rgba(99, 102, 241, 0.3)",
        "glow-sm": "0 0 10px rgba(99, 102, 241, 0.2)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config as unknown as Config;
