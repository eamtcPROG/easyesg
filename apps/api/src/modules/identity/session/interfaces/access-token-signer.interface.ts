/**
 * Access token issuance, behind a port (AD-12, P-7).
 *
 * The port exists so the sign-in and refresh use cases stay framework-free — `@nestjs/jwt` is a
 * Nest wrapper and `domain-free-of-frameworks` would rightly reject it in `use-cases/` — and so
 * AD-12's claim discipline is stated in exactly one adapter: the token carries the session id
 * and **nothing else of authorization consequence**. No role, no organization, no entitlement
 * snapshot; task 28's guard resolves all of those per request from the session record, which is
 * what makes FR-58's "next request, not next login" true.
 *
 * Verification is deliberately NOT on this port. Nothing in task 21 verifies an access token —
 * sign-out authenticates by refresh token — and the verifying side is the guard chain's seam
 * (task 28), which will state its own requirements rather than inherit a method nobody calls.
 */
export interface AccessTokenSigner {
  /** `expiresAt` is stamped into the claim; the value is `session-expiry.ts`'s to own. */
  sign(sessionId: string, expiresAt: Date): Promise<string>;
}

export const ACCESS_TOKEN_SIGNER = Symbol('ACCESS_TOKEN_SIGNER');
