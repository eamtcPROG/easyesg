/**
 * The web tier's own session routes (task 92) — `app/auth/session/`'s three handlers, as the browser
 * addresses them.
 *
 * **Not `ROUTES`**: those are screens, rendered under a locale and linked through `@/i18n/navigation`.
 * These are Route Handlers outside `[locale]`, fetched rather than navigated, and a `Link` built from one
 * would prefix a locale onto a path no page answers. The directory decides each path, so a string here is
 * a copy of a fact the file system owns — which is why `session-paths.spec.ts` holds each one to a
 * handler on disk.
 */
export const SESSION_TIER_PATH = {
  /** `GET` — is the session still held? `204` or `401`. `DELETE` — end whatever this browser holds. */
  SESSION: '/auth/session',
  /** `POST` — the dialogue's password. */
  PASSWORD: '/auth/session/password',
  /** `POST` — the dialogue's second-factor code. */
  FACTOR: '/auth/session/factor',
} as const;
