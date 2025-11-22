import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        flare: {
          primary: "#FF6B6B",
          secondary: "#4ECDC4",
          dark: "#1A1A2E",
          light: "#16213E",
        },
      },
    },
  },
  plugins: [],
};
export default config;
