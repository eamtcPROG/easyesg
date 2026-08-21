import { createHash, randomBytes } from 'node:crypto';

/**
 * Refresh token mint and hash (AD-12, NFR-64, §12.5.6).
 *
 * Framework-free; `node:crypto` is a runtime primitive, not a framework the layering keeps out.
 *
 * The same §12.5.6 properties as the verification token, restated here rather than imported from
 * `account/domain/verification-token.ts` because each token kind documents its own object (the
 * stance task 19's migration already takes for the tables): **≥ 256 bits from a CSPRNG**, **stored
 * SHA-256**, **single-use** — single use enforced by the store's conditional consume, since "used
 * exactly once under concurrency" is a claim only the database can make. No TTL is minted into the
 * token: a refresh token lives exactly as long as its session says (see `session-expiry.ts`), and
 * §7.9's rule against `uuidv7()` for externally visible tokens applies — v7 would ship a
 * predictable timestamp prefix on a value whose whole job is to be unguessable.
 *
 * base64url because the value travels in JSON bodies and, on the web side, in a cookie —
 * no character that needs escaping in either.
 */

/** 32 bytes = 256 bits, §12.5.6's floor. */
const TOKEN_BYTES = 32;

/**
 * How long after rotation a re-presented (consumed) token is read as a benign race rather than
 * as theft. Two legitimate refreshes can cross on the wire — two tabs, a retry after a timeout
 * whose first attempt actually landed — and the loser presents a token consumed milliseconds
 * ago. Revoking the session on that would sign users out at random under exactly the conditions
 * (slow networks, filing-window load) where retries happen; a stolen token, by contrast, is
 * replayed on the attacker's schedule, far outside this window. Within the grace the answer is
 * still a refusal — the rotation's winner holds the only live token — just not a revocation.
 */
export const REFRESH_REUSE_GRACE_MS = 30 * 1000;

export interface MintedRefreshToken {
  /** The only place the raw value exists; it goes to the caller and is never stored. */
  readonly value: string;
  /** What the store keeps — unusable to any reader of the table. */
  readonly hash: Buffer;
}

export function mintRefreshToken(): MintedRefreshToken {
  const value = randomBytes(TOKEN_BYTES).toString('base64url');
  return { value, hash: hashRefreshToken(value) };
}

export function hashRefreshToken(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}
