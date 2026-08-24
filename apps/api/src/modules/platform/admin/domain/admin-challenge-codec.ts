import { ADMIN_ROLE, type AdminRole } from '../models/admin-session.model';
import { sealJson, unsealJson } from './sealed-payload';

/**
 * The factor challenge — step one's verified credential, sealed (task 23 review, 24 Aug 2026:
 * A-01's two-step handshake, §12.5.6's challenge row).
 *
 * **Stateless by design**: the sealed cookie IS the challenge — no table, no cleanup sweep.
 * What it proves is exactly its contents: THIS api verified THIS account's password at
 * `issuedAt`. The state a table would add is single-use consumption, and the challenge is
 * deliberately NOT single-use within its window: a mistyped code must leave the operator on
 * the factor step to retype (A-01's "failed factor" is a recoverable state), not bounce them
 * to their password. Code guessing against a held challenge is bounded the same way it was in
 * the one-shot flow — §12.5.6's throttle window and the ten-failure lockout.
 *
 * The `kind` discriminator is load-bearing, not decorative: this payload and the session
 * cookie's are sealed under the SAME derived key, and the sealing primitive proves origin, not
 * kind — so each codec must refuse the other's shape by construction. (The session payload
 * carries no `kind` field, so it fails here on the literal; this one fails there on the
 * missing token members.)
 */
export const ADMIN_CHALLENGE_KIND = 'admin-factor-challenge';

export interface AdminChallengePayload {
  readonly kind: typeof ADMIN_CHALLENGE_KIND;
  readonly accountId: string;
  readonly email: string;
  readonly role: AdminRole;
  /** Epoch-ms; the TTL is evaluated at the point of use (`admin-session-expiry.ts`), never
   *  baked into the payload — the same computed-not-stored stance as every lifetime here. */
  readonly issuedAt: number;
}

export function sealAdminChallenge(
  payload: AdminChallengePayload,
  key: Buffer,
): string {
  return sealJson(payload, key);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isAdminRole = (value: unknown): value is AdminRole =>
  typeof value === 'string' && (Object.values(ADMIN_ROLE) as readonly string[]).includes(value);

/** Validated, never cast — anything that is not exactly a challenge reads as "no challenge". */
export function unsealAdminChallenge(sealed: string, key: Buffer): AdminChallengePayload | null {
  const parsed = unsealJson(sealed, key);
  if (!isRecord(parsed) || parsed.kind !== ADMIN_CHALLENGE_KIND) return null;
  const { accountId, email, role, issuedAt } = parsed;
  if (
    typeof accountId !== 'string' ||
    typeof email !== 'string' ||
    !isAdminRole(role) ||
    typeof issuedAt !== 'number'
  ) {
    return null;
  }
  return { kind: ADMIN_CHALLENGE_KIND, accountId, email, role, issuedAt };
}
