import { ADMIN_ROLE, type AdminRole } from '../models/admin-session.model';
import { sealJson, unsealJson } from './sealed-payload';

/**
 * The admin session cookie's codec — §12.5.6's task-23 cookie row. The api-side twin of
 * `apps/web`'s `session-codec.ts`, and a twin rather than a shared module by construction:
 * the two run in different applications with different secrets, and the one thing they share
 * — AES-256-GCM over a JSON payload, `iv | tag | ciphertext`, base64url — is the algorithm,
 * not code that could drift apart meaningfully. Within THIS app the wrapper does live once —
 * `sealed-payload.ts`, shared with the factor challenge's codec since the 24 Aug 2026 review —
 * and this file owns only the payload shape and its validation.
 *
 * The 256-bit key arrives DERIVED (see `admin-token.interface.ts` on the HKDF split): this file
 * never sees `AUTH_ADMIN_SECRET` itself, so it cannot accidentally reuse the JWT key as the
 * sealing key. Unseal answers `null` for anything not sealed by this codec under this key —
 * tampering, truncation, rotation, garbage — because every request carries the cookie and none
 * of those may throw.
 */

/** What the sealed cookie holds. Instants as epoch-ms — the payload is a wire format (OQ-50). */
export interface AdminCookiePayload {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: number;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: number;
  readonly identity: {
    readonly id: string;
    readonly email: string;
    readonly role: AdminRole;
  };
}

export function sealAdminCookie(payload: AdminCookiePayload, key: Buffer): string {
  return sealJson(payload, key);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isAdminRole = (value: unknown): value is AdminRole =>
  typeof value === 'string' &&
  (Object.values(ADMIN_ROLE) as readonly string[]).includes(value);

/** Validated, never cast — a stale payload shape must read as "no session", not crash later. */
function readPayload(parsed: unknown): AdminCookiePayload | null {
  if (!isRecord(parsed) || !isRecord(parsed.identity)) return null;
  const { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt } = parsed;
  const { id, email, role } = parsed.identity;
  if (
    typeof accessToken !== 'string' ||
    typeof accessTokenExpiresAt !== 'number' ||
    typeof refreshToken !== 'string' ||
    typeof refreshTokenExpiresAt !== 'number' ||
    typeof id !== 'string' ||
    typeof email !== 'string' ||
    !isAdminRole(role)
  ) {
    return null;
  }
  return {
    accessToken,
    accessTokenExpiresAt,
    refreshToken,
    refreshTokenExpiresAt,
    identity: { id, email, role },
  };
}

export function unsealAdminCookie(sealed: string, key: Buffer): AdminCookiePayload | null {
  return readPayload(unsealJson(sealed, key));
}
