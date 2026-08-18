/**
 * `features/export`
 *
 * Preview, export dialogue, export history.
 *
 * Mirrors `apps/api/src/modules/core/export`. S-10, S-11.
 *
 * Export is an async job from the first interaction (UX-46, AD-10): 202 plus a job id, a named
 * place to watch, and delivery by notification past 30 s. FR-53 requires a prior export to be
 * re-downloadable byte-for-byte, so the download path must not re-serialise the body.
 *
 * Not built. Folders are `components/ hooks/ schema/ queries/ types/`, tests colocated as
 * `*.spec.tsx`.
 */
export {};
