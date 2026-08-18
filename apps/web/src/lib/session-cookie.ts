/**
 * Session cookie names. Deliberately not in `src/server/` and deliberately carrying no
 * `server-only` marker: `proxy.ts` needs them and is neither a Server Component nor a client
 * bundle. Names are not secrets; the values never leave the server.
 */

/**
 * The opaque, server-side, rotated-on-use refresh token (AD-12). httpOnly, so no token is ever
 * exposed to browser JavaScript (AD-9). The short-lived access JWT is exchanged for it inside
 * the Node tier and never persisted here.
 */
export const REFRESH_COOKIE = 'easyesg_session';

/**
 * next-intl's locale cookie. The session writes it at sign-in from the user's profile
 * preference (S-27, FR-10), which is how a signed-in user's language reaches the bare-path
 * redirect without the redirect having to know about sessions.
 */
export const LOCALE_COOKIE = 'NEXT_LOCALE';
