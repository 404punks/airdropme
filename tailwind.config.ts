import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070b14",
        navy: "#0c1426",
        panel: "#121b31",
        panel2: "#18243d",
        line: "#2a3b5c",
        mist: "#e7eefc",
        mute: "#b7c3dc",
        violet: "#9b7bff",
        acid: "#3dff9a",
        warn: "#ffc46b",
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
