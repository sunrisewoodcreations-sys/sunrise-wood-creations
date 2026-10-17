/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        walnut: "#2E2420",
        bark: "#1F1814",
        cream: "#FAF6EE",
        sawdust: "#F0E8DA",
        amber: "#E8A33D",
        ember: "#D9603A",
        accent: "#A63D2F",
        sage: "#6E8560",
        charcoal: "#2E2420"
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-worksans)", "sans-serif"],
        mono: ["var(--font-plexmono)", "monospace"]
      }
    }
  },
  plugins: []
};
