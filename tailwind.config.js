/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        walnut: "#3D2B1F",
        bark: "#2A1D15",
        cream: "#F7F1E6",
        sawdust: "#EFE4CF",
        amber: "#E8A33D",
        ember: "#D9603A",
        sage: "#6E8560",
        charcoal: "#2A211C"
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
