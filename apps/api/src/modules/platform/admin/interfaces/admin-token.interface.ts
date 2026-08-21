/**
 * The admin realm's token operations, behind one port (AD-12, P-7; §12.5.6's task-23 rows).
 *
 * Unlike the tenant `AccessTokenSigner`, this port carries **verify** from day one: the api is
 * both issuer and verifier here (OQ-17 — the token handler is a route on the api), and the
 * resolve path must judge the sealed cookie's access token on every `GET /auth/admin/session`.
 * The tenant port deliberately deferred verification to task 28's guard; the admin realm cannot.
 *
 * **One secret, two derived keys.** `AUTH_ADMIN_SECRET` is never used directly: the adapter
 * derives the HS256 signing key and the cookie's AES-256-GCM sealing key from it with HKDF
 * under distinct labels, so one rotation retires both and neither key can be mistaken for the
 * other. Deriving from the TENANT `AUTH_JWT_SECRET` was rejected by name — NFR-65's "no shared
 * credential" includes the signing key, and disjoint secrets are what make a tenant access
 * token structurally unable to verify as an admin one.
 *
 * The claim discipline is AD-12's, unchanged: `sub` is the admin session id, plus `exp`/`iat` —
 * no role, no email, nothing of authorization consequence. Identity rides the sealed cookie's
 * own block; authorization is read per request once task 28's guard exists.
 */
export interface AdminTokens {
  /** `expiresAt` is stamped into the claim; the value is `admin-session-expiry.ts`'s to own. */
  sign(sessionId: string, expiresAt: Date): Promise<string>;

  /** The session id iff signature and `exp` hold — `null` for everything else, because an
   *  expired access token is the resolve path's ROTATE signal, not an error. */
  verify(token: string): Promise<string | null>;

  /** The cookie sealing key (HKDF-derived, distinct label) — handed out so the service seals
   *  with a key this adapter guarantees is not the signing key. */
  cookieKey(): Buffer;
}

export const ADMIN_TOKENS = Symbol('ADMIN_TOKENS');
