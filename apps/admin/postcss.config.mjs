// Tailwind 4 ships its PostCSS integration as a separate package (architecture.md §12.2).
// Identical to apps/web's: the two front ends consume one token cascade (UX-127) and must not
// diverge in how they process it.
export default { plugins: { '@tailwindcss/postcss': {} } };
