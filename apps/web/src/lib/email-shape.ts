/**
 * Whether a string has the shape of an email address — a shape test, not a validity test. What makes an address
 * deliverable is not decidable in a form and is not the form's business; this only decides whether a string is worth
 * sending, which is field-level UX carrying no business meaning — the line `apps/web/CLAUDE.md` draws for what may
 * live in a form. The API re-checks every address it stores.
 *
 * **One declaration** since task 177: it was written out in four forms, and S-13's report contact would have been a
 * fifth — one regular expression, not five that can drift.
 */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
