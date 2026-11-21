import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg)",
        elevated: "var(--bg-elevated)",
        ink: "var(--text)",
        muted: "var(--text-muted)",
        line: "var(--border)",
        accent: "var(--accent)",
        "accent-fg": "var(--accent-fg)",
        "accent-soft": "var(--accent-soft)",
        "accent-hover": "var(--accent-hover)",
        wheat: "var(--wheat)",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "var(--font-te)",
          "var(--font-deva)",
          "var(--font-kn)",
          "var(--font-ta)",
          "sans-serif",
        ],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
