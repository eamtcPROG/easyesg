/**
 * The admin session cookie's name and attribute string — §12.5.6's task-23 cookie row as code.
 *
 * `SameSite=Strict`, deliberately stricter than the web tier's `Lax`: `admin.<host>` →
 * `api.<host>` is cross-origin but same-SITE, so `Strict` still flows on every console fetch,
 * and nothing legitimate ever arrives at the api origin by top-level navigation carrying an
 * admin session — the email-link arrival that forced `Lax` on the tenant surface does not
 * exist here. Host-only (no `Domain`), `Path=/`, `Secure` (localhost is a trustworthy origin
 * for dev), `HttpOnly` because the whole design exists to keep the pair out of browser
 * JavaScript (AD-12, OQ-17).
 */
export const ADMIN_SESSION_COOKIE = 'easyesg_admin_session';

/** Step one's sealed factor challenge (the handshake, 24 Aug 2026) — same attributes, its own
 *  name, so neither cookie can ever be read as the other even before the codecs' shape checks. */
export const ADMIN_CHALLENGE_COOKIE = 'easyesg_admin_challenge';

const COOKIE_ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Strict';

export function adminSessionCookie(sealed: string, maxAgeSeconds: number): string {
  return `${ADMIN_SESSION_COOKIE}=${sealed}; Max-Age=${Math.max(0, maxAgeSeconds)}; ${COOKIE_ATTRIBUTES}`;
}

/** Max-Age=0 with matching attributes — the only reliable cross-browser clear. */
export function clearedAdminSessionCookie(): string {
  return `${ADMIN_SESSION_COOKIE}=; Max-Age=0; ${COOKIE_ATTRIBUTES}`;
}

export function adminChallengeCookie(sealed: string, maxAgeSeconds: number): string {
  return `${ADMIN_CHALLENGE_COOKIE}=${sealed}; Max-Age=${Math.max(0, maxAgeSeconds)}; ${COOKIE_ATTRIBUTES}`;
}

export function clearedAdminChallengeCookie(): string {
  return `${ADMIN_CHALLENGE_COOKIE}=; Max-Age=0; ${COOKIE_ATTRIBUTES}`;
}

/**
 * The one cookie this realm reads, out of a raw `Cookie` header. A full parser is not needed —
 * the name is fixed and the value is base64url, so the first `name=` pair wins and no decoding
 * applies.
 */
function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1) || undefined;
    }
  }
  return undefined;
}

export const readAdminSessionCookie = (header: string | undefined): string | undefined =>
  readCookie(header, ADMIN_SESSION_COOKIE);

export const readAdminChallengeCookie = (header: string | undefined): string | undefined =>
  readCookie(header, ADMIN_CHALLENGE_COOKIE);
