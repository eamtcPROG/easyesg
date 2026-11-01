import { createHash, randomInt } from 'node:crypto';

/**
 * Recovery codes for the opt-in second factor (NFR-95, UC-195; task 27.2). §12.5.6's
 * recovery-code row is normative and this file is its implementation.
 *
 * Framework-free; `node:crypto` is a runtime primitive, not a framework the layering keeps out.
 *
 * **Why the parameters differ from every other token in this schema, which is the interesting
 * part.** §12.5.6 gives verification, reset and refresh tokens ≥ 256 bits, base64url, SHA-256,
 * single-use. Three of those four carry over unchanged. The entropy does not, and cannot: those
 * tokens travel in a link that a machine copies, while a recovery code is **transcribed by a
 * person from paper**, so its length is bounded by what someone will retype correctly at the worst
 * possible moment — locked out, on a phone they have just replaced.
 *
 * Sixteen Crockford base32 characters is the answer that row records: ~80 bits, which is what
 * makes an **offline** attack on a stolen database dump pointless. Ten characters (~50 bits) would
 * be friendlier to type and is what many products issue; it is also within reach of a determined
 * attacker holding a dump, and a recovery code is precisely the credential that sits unused and
 * valid for longest. Online guessing is bounded by the auth-path throttle and FR-4's lockout at
 * either length, so the length is buying protection against the dump and nothing else.
 *
 * **SHA-256 rather than Argon2id**, and it is the same reasoning §12.5.6 already applies to its
 * tokens rather than an exception to it: a slow hash exists to make *low*-entropy inputs expensive
 * to guess, and 80 random bits are not low-entropy. It would also cost real time on the wrong path
 * — codes are indistinguishable until matched, so verification tries each of the ten in turn, and
 * ten deliberately-expensive hashes per attempt is a denial-of-service lever on a sign-in step.
 */

/** §12.5.6: ten codes per issue, and re-issuing replaces the whole set. */
export const RECOVERY_CODE_COUNT = 10;

/** Sixteen characters ≈ 80 bits over the 32-character alphabet below. */
const CODE_LENGTH = 16;

/** How the code is shown and expected back: four groups of four. */
const GROUP_SIZE = 4;

/**
 * Crockford's base32 alphabet — RFC 4648's minus `I`, `L`, `O` and `U`.
 *
 * The exclusions are the point rather than a detail: the reader is retyping from paper, and
 * `0`/`O` and `1`/`I`/`L` are where that goes wrong. `U` is dropped by Crockford to avoid
 * accidental obscenities. `normaliseRecoveryCode` below folds the confusable characters back in,
 * so someone who types the letter O where a zero was printed is admitted rather than refused —
 * a refusal there would look to them exactly like a spent code.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * `randomInt` rather than `randomBytes` with a modulo: the modulo is biased whenever the alphabet
 * does not divide 256, and 32 does — so it would be *correct here* and wrong the day someone
 * changes the alphabet. `randomInt` is rejection-sampled by Node and cannot acquire that bug.
 */
const mintOne = (): string =>
  Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** Grouped for transcription; the groups are presentation and never reach the hash. */
export const formatRecoveryCode = (code: string): string =>
  (code.match(new RegExp(`.{1,${GROUP_SIZE}}`, 'gu')) ?? []).join('-');

/**
 * What the user typed, reduced to what was minted.
 *
 * Applied before hashing on **both** the issue and the verify path, so the two cannot disagree
 * about what a code is. It folds Crockford's confusable characters (`O` → `0`, `I`/`L` → `1`) and
 * drops separators and case, which means the code works whether it is pasted with the hyphens the
 * screen printed, typed in lower case, or read aloud over a phone.
 */
export const normaliseRecoveryCode = (input: string): string =>
  input
    .toUpperCase()
    .replace(/[^0-9A-Z]/gu, '')
    .replace(/O/gu, '0')
    .replace(/[IL]/gu, '1');

export interface MintedRecoveryCodes {
  /** The only place the raw values exist; shown once and never stored (UC-193). */
  readonly values: readonly string[];
  /** What the store keeps, positionally aligned with `values`. */
  readonly hashes: readonly Buffer[];
}

export function mintRecoveryCodes(): MintedRecoveryCodes {
  const values = Array.from({ length: RECOVERY_CODE_COUNT }, mintOne);
  return { values, hashes: values.map(hashRecoveryCode) };
}

export function hashRecoveryCode(value: string): Buffer {
  return createHash('sha256').update(normaliseRecoveryCode(value), 'utf8').digest();
}
