/**
 * The tenant factor challenge's payload and its window (NFR-95, UC-194; task 27.3,
 * §12.5.6's tenant-factor-challenge row).
 *
 * **What it proves is exactly its contents: this API verified this account's password at
 * `issuedAt`.** It is not a session and cannot become one — it carries no token, and presenting it
 * without a valid code yields nothing. That is what makes it safe for the client to hold.
 *
 * **Stateless, like the admin realm's**: no table, no cleanup sweep, and the TTL is evaluated at
 * the point of use rather than baked into the payload — the computed-not-stored stance every
 * lifetime in this codebase takes, so changing the window is a constant here and not a data
 * migration.
 *
 * **Deliberately not single-use.** A mistyped code must leave the reader on the factor step to
 * retype it (S-01 draws that as a recoverable state), not bounce them back to their password.
 * Guessing against a held challenge is bounded exactly as it was before the step existed:
 * §12.5.6's throttle window and FR-4's ten-failure lockout, which factor failures count toward.
 *
 * Where it differs from `admin-challenge-codec.ts` is transport and nothing else. OQ-17 lets the
 * api set the admin session cookie, so that challenge rides one; OQ-33 gives the tenant session
 * cookie to `apps/web` and AD-9 makes this api a back channel that sets no tenant cookie — so the
 * sealed value is returned in the body and the client decides where to keep it.
 */

/**
 * The discriminator, and it is load-bearing rather than decorative. The sealing primitive proves
 * that THIS api sealed a value under THIS key — never which kind of value it is — so a payload
 * that could be reinterpreted as another kind must die on its shape. Nothing else in the tenant
 * realm is sealed under this derived key today, and the field is what keeps that true when
 * something is.
 */
export const FACTOR_CHALLENGE_KIND = 'tenant-factor-challenge';

export interface FactorChallengePayload {
  readonly kind: typeof FACTOR_CHALLENGE_KIND;
  readonly accountId: string;
  /** Epoch-ms — the payload is a wire format (OQ-50). */
  readonly issuedAt: number;
  /**
   * S-01's *Keep me signed in on this device*, carried across the factor step (OQ-35, amended
   * 4 Sep 2026).
   *
   * **It rides the sealed challenge rather than being asked again**, and the alternative is worth
   * stating because it looks simpler: a `remember` field on `POST /auth/session/factor` would make
   * the *client* responsible for holding an answer the person gave one screen earlier, so a client
   * that dropped it would quietly shorten the session with nothing failing. Sealed here, the answer
   * is the API's own and cannot be edited by whoever holds the challenge — the same property the
   * `kind` discriminator above exists for.
   *
   * The cost, once, on deploy: a challenge sealed by the previous build lacks the field and reads
   * as no challenge, so anyone mid-factor retypes their password. The window is five minutes.
   */
  readonly remembered: boolean;
}

/**
 * Five minutes, matching the admin realm's window (§12.5.6, task 23 review).
 *
 * Long enough to find a phone, open an authenticator and type six digits — including the second
 * attempt after a mistype, since the challenge survives one. Short enough that a value which
 * leaks from a client is worthless before it can be used.
 */
export const FACTOR_CHALLENGE_TTL_MS = 5 * 60 * 1000;

export const factorChallengeHasExpired = (
  challenge: FactorChallengePayload,
  now: Date,
): boolean => now.getTime() - challenge.issuedAt >= FACTOR_CHALLENGE_TTL_MS;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Validated, never cast — anything that is not exactly a challenge reads as "no challenge".
 *
 * Exported so the adapter that owns the key can reuse it: the *shape* is this module's rule and
 * the *sealing* is infrastructure's, and keeping them apart is what lets the payload be specified
 * here without the domain importing a cipher.
 */
export function readFactorChallenge(parsed: unknown): FactorChallengePayload | null {
  if (!isRecord(parsed) || parsed.kind !== FACTOR_CHALLENGE_KIND) return null;
  const { accountId, issuedAt, remembered } = parsed;
  if (typeof accountId !== 'string' || typeof issuedAt !== 'number') return null;
  // Required, not defaulted: a payload missing it was sealed by a build that did not know the
  // question, and guessing an answer to "keep me signed in" is exactly what must not happen.
  if (typeof remembered !== 'boolean') return null;
  return { kind: FACTOR_CHALLENGE_KIND, accountId, issuedAt, remembered };
}
