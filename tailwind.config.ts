import type { Config } from "tailwindcss";

const config: Config = {
  content: {
    relative: true,
    files: [
      "./app/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/**/*.{js,ts,jsx,tsx,mdx}",
      "./packages/ui/**/*.{js,ts,jsx,tsx,css}",
    ],
  },
  theme: {
    extend: {
      colors: {
        kb: {
          blue: "#2b72f4",
          "blue-2": "#1a5fd4",
          bg: "#f5f7fa",
          ink: "#0f172a",
          muted: "#7a7f89",
          ok: "#16a34a",
          danger: "#dc2626",
          warn: "#c2410c",
        },
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        display: ["Nunito", "Manrope", "system-ui", "sans-serif"],
      },
      borderRadius: {
        kb: "28px",
        "kb-sm": "16px",
      },
      boxShadow: {
        kb: "0 24px 50px rgba(43, 114, 244, 0.12)",
        "kb-sm": "0 10px 28px rgba(15, 23, 42, 0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
