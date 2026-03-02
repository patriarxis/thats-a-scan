import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#191919",
        foreground: "#f9fafb",
        primary: {
          DEFAULT: "#ff6b35", // warm Up-style orange
          foreground: "#ffffff"
        },
        secondary: {
          DEFAULT: "#8f499c", // FlexOne purple accent
          foreground: "#ffffff"
        },
        muted: {
          DEFAULT: "#f3f4f6",
          foreground: "#6b7280"
        },
        border: "#e5e7eb",
        card: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a"
        }
      },
      fontFamily: {
        sans: ["system-ui", "ui-sans-serif", "sans-serif"]
      },
      boxShadow: {
        soft: "0 18px 45px rgba(15, 23, 42, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;

