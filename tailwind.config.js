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
        walnut: "#25282B",
        bark: "#1A1C1E",
        cream: "#F5F3EF",
        sawdust: "#E9E5DD",
        amber: "#E8A33D",
        ember: "#D9603A",
        brass: "#9E6A1C",
        sage: "#6E8560",
        charcoal: "#25282B"
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
