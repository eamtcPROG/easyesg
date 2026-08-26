import type { FactorChallengePayload } from '../domain/factor-challenge';

/**
 * Sealing the factor challenge, behind a port (P-7; task 27.3).
 *
 * The port exists for `AccessTokenSigner`'s reason exactly: the sign-in use cases stay
 * framework-free and hold no key material, and the one place the derivation is stated is the
 * adapter. A use case handed a `Buffer` would be a use case that could seal the wrong thing with
 * it — which is why this is `seal`/`open` rather than the admin realm's `cookieKey()`, where the
 * *service* does the sealing and legitimately needs the key.
 */
export interface FactorChallengeSealer {
  seal(challenge: Omit<FactorChallengePayload, 'kind'>): string;

  /** `null` for anything this api did not seal under this key, or that is not a challenge. */
  open(sealed: string): FactorChallengePayload | null;
}

export const FACTOR_CHALLENGE_SEALER = Symbol('FACTOR_CHALLENGE_SEALER');
