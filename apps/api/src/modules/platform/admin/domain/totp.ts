import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP for the admin realm's second factor (FR-75, UC-68; §12.5.6's task-23 MFA row) —
 * RFC 6238 over RFC 4226, SHA-1, 6 digits, 30-second step, ±1 step of verification window.
 *
 * Hand-rolled rather than pinned, the same call as the cookie sealing (OQ-33): the whole need
 * is one HMAC, one truncation and a base32 codec — under forty lines against a spec that ships
 * its own test vectors, which `totp.spec.ts` pins verbatim. A dependency would be a §12 row for
 * an algorithm whose reference implementation fits in this file; task 27 (tenant TOTP, with
 * enrolment and recovery codes) is the point to revisit if the need outgrows this.
 *
 * SHA-1 is deliberate, not legacy drift: RFC 6238's HMAC-SHA-1 mode is what every authenticator
 * app enrols by default, HMAC-SHA-1 is not affected by SHA-1's collision break, and an otpauth
 * URI declaring SHA-256 is silently ignored by some clients — producing codes that never match,
 * which presents as "MFA is broken" with nothing in any log.
 *
 * Framework-free; `node:crypto` is a runtime primitive, not a framework the layering keeps out.
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

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/** `null` for anything that is not base32 — a corrupt secret must read as "wrong code", never
 *  throw on the sign-in path. Case-insensitive, padding tolerated, per common authenticator use. */
export function decodeBase32(secret: string): Buffer | null {
  const normalised = secret.toUpperCase().replace(/=+$/u, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of normalised) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function mintTotpSecret(): string {
  return encodeBase32(randomBytes(SECRET_BYTES));
}

/** RFC 4226 §5.3 — HMAC, dynamic truncation, decimal reduction. */
function hotp(key: Buffer, counter: bigint): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = digest.readUInt32BE(offset) & 0x7fffffff;
  return (code % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0');
}

export interface TotpVerification {
  readonly secret: string;
  readonly code: string;
}

/**
 * The code an authenticator shows at `now` — what the e2e suites play the operator's app with,
 * and what task 27's enrolment confirmation will echo back. `null` mirrors `decodeBase32`:
 * a corrupt secret is a refusal, never a throw.
 */
export function totpCodeAt(secret: string, now: Date): string | null {
  const key = decodeBase32(secret);
  if (key === null || key.length === 0) return null;
  return hotp(key, BigInt(Math.floor(now.getTime() / 1000 / TOTP_STEP_SECONDS)));
}

/**
 * True iff the code matches the current step or one either side. Comparison is constant-time
 * per candidate; the early shape check discloses nothing a caller did not send.
 */
export function verifyTotp(input: TotpVerification, now: Date): boolean {
  if (!/^\d{6}$/u.test(input.code)) return false;
  const key = decodeBase32(input.secret);
  if (key === null || key.length === 0) return false;

  const step = BigInt(Math.floor(now.getTime() / 1000 / TOTP_STEP_SECONDS));
  const presented = Buffer.from(input.code, 'utf8');
  let matched = false;
  for (let offset = -VERIFICATION_WINDOW_STEPS; offset <= VERIFICATION_WINDOW_STEPS; offset += 1) {
    const candidateStep = step + BigInt(offset);
    // A window edge before the epoch has no counter to probe (RFC 4226's counter is unsigned);
    // skipped rather than thrown, because nothing on a sign-in path may throw on shape.
    if (candidateStep < 0n) continue;
    const candidate = Buffer.from(hotp(key, candidateStep), 'utf8');
    // No early exit: every window is compared so timing does not say WHICH one matched.
    if (timingSafeEqual(candidate, presented)) matched = true;
  }
  return matched;
}

/**
 * The enrolment string the provisioning CLI prints (§12.5.6's task-23 MFA row) — what an
 * authenticator app's QR scanner or manual entry consumes. Label and issuer per the de-facto
 * Key Uri Format; the parameters restate this file's constants so a client that reads them
 * agrees with the verifier that ignores them.
 */
export function totpEnrolmentUri(email: string, secret: string): string {
  const issuer = encodeURIComponent('EasyESG Admin');
  return (
    `otpauth://totp/${issuer}:${encodeURIComponent(email)}` +
    `?secret=${secret}&issuer=${issuer}&algorithm=SHA1` +
    `&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`
  );
}
