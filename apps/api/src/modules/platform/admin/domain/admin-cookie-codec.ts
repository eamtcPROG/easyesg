import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ADMIN_ROLE, type AdminRole } from '../models/admin-session.model';

/**
 * The admin session cookie's codec — §12.5.6's task-23 cookie row. The api-side twin of
 * `apps/web`'s `session-codec.ts`, and a twin rather than a shared module by construction:
 * the two run in different applications with different secrets, and the one thing they share
 * — AES-256-GCM over a JSON payload, `iv | tag | ciphertext`, base64url — is the algorithm,
 * not code that could drift apart meaningfully.
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

const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

export function sealAdminCookie(payload: AdminCookiePayload, key: Buffer): string {
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
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
  try {
    const raw = Buffer.from(sealed, 'base64url');
    if (raw.length <= GCM_IV_LENGTH + GCM_TAG_LENGTH) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, GCM_IV_LENGTH));
    decipher.setAuthTag(raw.subarray(GCM_IV_LENGTH, GCM_IV_LENGTH + GCM_TAG_LENGTH));
    const plaintext = Buffer.concat([
      decipher.update(raw.subarray(GCM_IV_LENGTH + GCM_TAG_LENGTH)),
      decipher.final(),
    ]).toString('utf8');
    return readPayload(JSON.parse(plaintext));
  } catch {
    return null;
  }
}
