// Tailwind 4 ships its PostCSS integration as a separate package (§12.2). Sass runs BEFORE
// Tailwind: .scss files in packages/ui consume tokens through @use, and Tailwind's own entry
// stays in a plain .css file so Sass never tries to resolve @import "tailwindcss" itself.
export default {
  plugins: { '@tailwindcss/postcss': {} },
};
