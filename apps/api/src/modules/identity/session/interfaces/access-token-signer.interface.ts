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
 * Verification was deliberately NOT on this port in task 21 — nothing verified an access token,
 * sign-out authenticates by refresh token, and this header said the verifying side would "state its
 * own requirements rather than inherit a method nobody calls". Task 28.1 states them, below.
 */
export interface AccessTokenSigner {
  /** `expiresAt` is stamped into the claim; the value is `session-expiry.ts`'s to own. */
  sign(sessionId: string, expiresAt: Date): Promise<string>;
}

export const ACCESS_TOKEN_SIGNER = Symbol('ACCESS_TOKEN_SIGNER');

/**
 * The verifying half, a **separate port implemented by the same adapter** (task 28.1).
 *
 * Separate because the two capabilities have disjoint consumers and ISP says a consumer must not
 * depend on operations it never calls: the sign-in and refresh use cases sign and never verify;
 * `AuthGuard` verifies and never signs. One adapter holds both because they share the one symmetric
 * secret, and splitting the adapter would mean two objects that must agree about it.
 *
 * It answers the session id or `null`, and **`null` is every failure collapsed**: bad signature,
 * wrong algorithm, expired `exp`, malformed token, a `sub` that is not there. The guard turns all
 * of them into one `401`, because the distinctions describe our verification to whoever is probing
 * it and none of them changes what the caller should do — sign in again.
 *
 * It does **not** throw on an expired token. Expiry is the ordinary end of a 15-minute credential,
 * not an exceptional condition, and the web tier rotates before it arrives.
 */
export interface AccessTokenVerifier {
  /** The `sub` claim — a session id — or `null` if the token is not one this API issued and honours. */
  verify(accessToken: string): Promise<string | null>;
}

export const ACCESS_TOKEN_VERIFIER = Symbol('ACCESS_TOKEN_VERIFIER');
