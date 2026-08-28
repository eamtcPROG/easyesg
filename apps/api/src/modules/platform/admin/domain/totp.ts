import { Secret, TOTP } from 'otpauth';

/**
 * TOTP for the admin realm's second factor (FR-75, UC-68; §12.5.6's task-23 MFA row) —
 * RFC 6238 over RFC 4226, SHA-1, 6 digits, 30-second step, ±1 step of verification window.
 *
 * **A thin wrapper over `otpauth` (§12.1), not an implementation.** This file first shipped
 * hand-rolled — a base32 codec, the HMAC truncation and the window loop, about ninety lines —
 * on the argument that the RFC ships its own test vectors. That argument was wrong twice over
 * (reviewed 24 Aug 2026), and the reasons are worth keeping because they generalise:
 *
 *  - **The vectors only prove the happy path.** The hand-rolled version passed all six of
 *    RFC 6238's vectors while carrying a real defect: at step 0 the ±1 window probed counter
 *    −1 and `writeBigUInt64BE` threw. A negative-case probe found it, not the vectors. That is
 *    the precise argument for not hand-rolling security primitives — the failures live in the
 *    malformed and boundary inputs a specification's examples do not cover.
 *  - **Node has no base32** (verified on 26.7.0: `Buffer` does `base64url` and `hex`, not
 *    `base32`), so a codec was genuinely needed — but a maintained one existed.
 *
 * `otpauth` was chosen over `otplib` (needs preset assembly) and over a bare codec like
 * `@scure/base` (which would have left the truncation and window hand-rolled — the half where
 * the bug actually was). It is MIT, depends only on `@noble/hashes`, ships a real Node
 * CommonJS build — `exports['.'].node.require`, verified by an actual `require()`, so OQ-48's
 * objection to `jose` does not apply — and compares with `crypto.timingSafeEqual` internally.
 *
 * One deliberate, recorded difference from the hand-rolled version: `TOTP.validate` returns on
 * its first matching window rather than comparing all three, so timing can in principle reveal
 * WHICH window matched. That discloses a ±30 s clock offset to someone who already holds a
 * valid code, which is not a weakness worth a private implementation.
 *
 * SHA-1 is deliberate, not legacy drift: RFC 6238's HMAC-SHA-1 mode is what every authenticator
 * app enrols by default, HMAC-SHA-1 is unaffected by SHA-1's collision break, and an otpauth
 * URI declaring SHA-256 is silently ignored by some clients — producing codes that never match,
 * which presents as "MFA is broken" with nothing in any log.
 *
 * Framework-free: `otpauth` is a pure computation library, exactly as `node:crypto` is a
 * runtime primitive — `domain-free-of-frameworks` bans NestJS, TypeORM, Express, ioredis and
 * BullMQ from this directory, and a codec is none of them.
 */

export const TOTP_DIGITS = 6;
export const TOTP_STEP_SECONDS = 30;

/**
 * ±1 step: a code from the previous or next window is accepted, so a clock a few seconds adrift
 * or a code typed at the boundary does not refuse a legitimate operator. Wider would multiply an
 * attacker's guessing surface for no operational gain — §12.5.6's throttle and lockout already
 * bound guessing, and this window sits inside them.
 */
const VERIFICATION_WINDOW_STEPS = 1;

/** 20 bytes = 160 bits, RFC 4226's recommended secret length for SHA-1. */
const SECRET_BYTES = 20;

const ISSUER = 'EasyESG Admin';

/** The parameters, in one place: the verifier, the code generator and the enrolment URI are all
 *  built from this, so a client that reads them agrees with the verifier. One named input —
 *  `secret` and `label` are both strings, and swapped positionally `Secret.fromBase32` would read
 *  the label, refusing every code as "wrong" with nothing in any log (CLAUDE.md's
 *  adjacent-same-type rule). */
const totpFor = (input: { readonly secret: string; readonly label: string }): TOTP =>
  new TOTP({
    issuer: ISSUER,
    label: input.label,
    algorithm: 'SHA1',
    digits: TOTP_DIGITS,
    period: TOTP_STEP_SECONDS,
    secret: Secret.fromBase32(input.secret),
  });

export function mintTotpSecret(): string {
  return new Secret({ size: SECRET_BYTES }).base32;
}

export interface TotpVerification {
  readonly secret: string;
  readonly code: string;
}

/**
 * True iff the code matches the current step or one either side.
 *
 * Every refusal path answers `false` rather than throwing — a malformed code, and a secret too
 * corrupt to be base32, are both "wrong code" on a sign-in path. `Secret.fromBase32` throws on
 * an invalid secret, which is why the construction is inside the `try`.
 */
export function verifyTotp(input: TotpVerification, now: Date): boolean {
  if (!/^\d{6}$/u.test(input.code)) return false;
  try {
    const delta = totpFor({ secret: input.secret, label: ISSUER }).validate({
      token: input.code,
      timestamp: now.getTime(),
      window: VERIFICATION_WINDOW_STEPS,
    });
    return delta !== null;
  } catch {
    return false;
  }
}

/**
 * The code an authenticator shows at `now` — what the e2e suites play the operator's app with,
 * and what task 27's enrolment confirmation will echo back. `null` for a secret that is not
 * base32: a refusal, never a throw.
 */
export function totpCodeAt(secret: string, now: Date): string | null {
  try {
    return totpFor({ secret, label: ISSUER }).generate({ timestamp: now.getTime() });
  } catch {
    return null;
  }
}

/**
 * The enrolment string the provisioning CLI prints (§12.5.6's task-23 MFA row) — what an
 * authenticator app's QR scanner or manual entry consumes, in the Key Uri Format, emitted by
 * the same object that verifies so the two cannot disagree on parameters.
 */
export function totpEnrolmentUri(enrolment: {
  readonly email: string;
  readonly secret: string;
}): string {
  return totpFor({ secret: enrolment.secret, label: enrolment.email }).toString();
}
