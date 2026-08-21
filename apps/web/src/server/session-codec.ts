import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { LOCALES, type Locale } from '@easyesg/i18n';

/**
 * The sealed session cookie's codec — OQ-33 (closed 21 Aug 2026, architecture.md §12.5.6).
 *
 * One httpOnly cookie holds AD-12's whole session: both tokens, both expiries and the identity
 * block, as a single AES-256-GCM payload under `SESSION_SECRET`. Sealing is defence in depth on
 * top of httpOnly — the raw refresh token never leaves the Node tier in any readable form, and
 * a tampered cookie fails the ciphertext's authentication tag rather than reaching a parser.
 *
 * node:crypto rather than a sealing library: the whole need is one encrypt and one
 * authenticated decrypt with a random nonce, and a dependency would be a §12 pin for thirty
 * lines. GCM's nonce is generated fresh per seal from a CSPRNG, which is safe at this volume
 * (the birthday bound on a 96-bit nonce is astronomically far from ≤3,000 users' sign-ins).
 *
 * This file is pure on purpose: no cookie store, no env access. `session.ts` (the request-
 * scoped session tier) and `api-client.ts` (which attaches the access token as ambient
 * context) both consume it, and neither may import the other — the split is what keeps that
 * acyclic.
 */

/** What the sealed cookie holds. Instants are epoch-ms, as everywhere on the wire (OQ-50). */
export interface SessionPayload {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
  account: {
    id: string;
    email: string;
    locale: Locale;
  };
}

const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

/** One 256-bit key from whatever length the deployment's secret has. */
const keyFor = (secret: string): Buffer => createHash('sha256').update(secret).digest();

export function sealSession(payload: SessionPayload, secret: string): string {
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Validated, never cast — the same rule the api client applies to response bodies. The payload
 * was sealed by this codec, so a shape mismatch means a secret rotation or a stale format, and
 * both must read as "no session", not as a crash on an undefined member.
 */
function readPayload(parsed: unknown): SessionPayload | null {
  if (!isRecord(parsed) || !isRecord(parsed.account)) return null;
  const { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt } = parsed;
  const { id, email, locale } = parsed.account;
  if (
    typeof accessToken !== 'string' ||
    typeof accessTokenExpiresAt !== 'number' ||
    typeof refreshToken !== 'string' ||
    typeof refreshTokenExpiresAt !== 'number' ||
    typeof id !== 'string' ||
    typeof email !== 'string' ||
    !isLocale(locale)
  ) {
    return null;
  }
  return {
    accessToken,
    accessTokenExpiresAt,
    refreshToken,
    refreshTokenExpiresAt,
    account: { id, email, locale },
  };
}

/**
 * `null` for anything that is not a payload this codec sealed with this secret: tampering,
 * truncation, a rotated `SESSION_SECRET`, garbage. All of them are the same fact — there is no
 * session — and none of them may throw, because this runs on every request carrying the cookie.
 */
export function unsealSession(sealed: string, secret: string): SessionPayload | null {
  try {
    const raw = Buffer.from(sealed, 'base64url');
    if (raw.length <= GCM_IV_LENGTH + GCM_TAG_LENGTH) return null;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyFor(secret),
      raw.subarray(0, GCM_IV_LENGTH),
    );
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
