/** Brand colours from the UrbanCart design: black, gold and cream. */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#000000",
        gold: { DEFAULT: "#D4AF37", dark: "#7A5F10" },
        cream: "#F7F1E3",
        card: "#FFFDF7",
        line: "#E3D8BC",
        muted: "#5E5546",
        body: "#26211A",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
