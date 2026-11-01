import { Secret, TOTP } from 'otpauth';

/**
 * The authenticator app's half of the exchange, for the browser e2e to play the operator with.
 *
 * This was a deliberate small COPY of the arithmetic, on the argument that sharing code with
 * the verifier would prove only that one function agrees with itself. That argument died with
 * the hand-rolled implementation (24 Aug 2026): the verifier is now `otpauth`, so both sides
 * using it is not self-agreement — the RFC 6238 vectors in `totp.spec.ts` are what prove the
 * math, and this suite's job is the wire journey, not the algorithm.
 *
 * Parameters are restated rather than imported from `apps/api`: this stands in for a
 * third-party authenticator, which knows only what the enrolment URI told it.
 */
const CONFIGURED = { algorithm: 'SHA1', digits: 6, period: 30 } as const;

/** The six digits an authenticator shows for `secret` right now. */
export function currentTotpCode(secret: string): string {
  return new TOTP({ ...CONFIGURED, secret: Secret.fromBase32(secret) }).generate();
}
