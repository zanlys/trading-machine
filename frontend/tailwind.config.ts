import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   "#0d0d0d",
          secondary: "#141414",
          card:      "#1a1a1a",
          border:    "#2a2a2a",
          hover:     "#222222",
        },
        accent: {
          blue:   "#60a5fa",
          cyan:   "#34d399",
          purple: "#a78bfa",
        },
        bull:  "#22c55e",
        bear:  "#f43f5e",
        neutral: "#6b7280",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
