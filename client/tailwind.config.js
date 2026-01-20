/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#00ff00",
          50: "#f0fff0",
          100: "#dcffdc",
          200: "#bbffbb",
          300: "#86ff86",
          400: "#4bff4b",
          500: "#00ff00",
          600: "#00cc00",
          700: "#009900",
          800: "#006600",
          900: "#003300",
        },
        cyber: {
          dark: "#0a0a0a",
          darker: "#050505",
          light: "#1a1a2e",
          accent: "#16213e",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        glow: "glow 2s ease-in-out infinite alternate",
        "pulse-glow": "pulse-glow 2s infinite",
        typing: "typing 1s steps(3) infinite",
        blink: "blink 1s infinite",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
      keyframes: {
        glow: {
          "0%": { textShadow: "0 0 5px #00ff00, 0 0 10px #00ff00" },
          "100%": {
            textShadow: "0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 30px #00ff00",
          },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 5px rgba(0, 255, 0, 0.5)" },
          "50%": { boxShadow: "0 0 20px rgba(0, 255, 0, 0.8)" },
        },
        typing: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        blink: {
          "0%, 50%": { opacity: "1" },
          "51%, 100%": { opacity: "0" },
        },
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      boxShadow: {
        glow: "0 0 10px rgba(0, 255, 0, 0.5)",
        "glow-lg": "0 0 20px rgba(0, 255, 0, 0.6)",
      },
    },
  },
  plugins: [],
};
