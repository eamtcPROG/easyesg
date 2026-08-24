/**
 * Session cookie names. Deliberately not in `src/server/` and deliberately carrying no
 * `server-only` marker: `proxy.ts` needs them and is neither a Server Component nor a client
 * bundle. Names are not secrets; the values never leave the server.
 */

/**
 * The one session cookie (OQ-33, closed 21 Aug 2026 — architecture.md §12.5.6): AD-12's whole
 * session — access token, rotated-on-use refresh token, both expiries, the identity block —
 * sealed AES-256-GCM under `SESSION_SECRET` by `src/server/session-codec.ts`. httpOnly, so no
 * token is ever exposed to browser JavaScript (AD-9); sealed, so none leaves the Node tier in
 * any readable form either.
 */
export const REFRESH_COOKIE = 'easyesg_session';

/**
 * next-intl's locale cookie. The session writes it at sign-in from the user's profile
 * preference (S-27, FR-10), which is how a signed-in user's language reaches the bare-path
 * redirect without the redirect having to know about sessions.
 */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * The in-flight OAuth transaction (task 24, §12.5.6's task-24 flow row): `state`, `nonce`, the
 * PKCE verifier, the intent and the return path, sealed under `SESSION_SECRET` by
 * `src/server/social-transaction.ts`. Short-lived, path-scoped to `/auth/social`, and
 * `SameSite=Lax` **by necessity, not habit**: the provider's callback arrives as a cross-site
 * top-level GET, which is exactly the navigation `Lax` still sends cookies on and `Strict`
 * does not — under `Strict` every callback would look like a restarted flow.
 */
export const SOCIAL_TRANSACTION_COOKIE = 'easyesg_social';
