import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07080c",
        navy: "#0e1016",
        panel: "#141821",
        panel2: "#1b2130",
        line: "#2c3344",
        mist: "#f3f5fb",
        mute: "#a8b0c2",
        violet: "#8b7cff",
        blue: "#5b8cff",
        acid: "#3ee0a2",
        warn: "#e2b15a",
        danger: "#ff6b8a",
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-syne)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        card: "0 20px 60px rgba(0, 0, 0, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
