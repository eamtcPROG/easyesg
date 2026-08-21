import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Verification token issue and comparison (FR-3, NFR-64, architecture.md §12.5.6).
 *
 * Framework-free by the `domain-free-of-frameworks` rule, and `node:crypto` does not breach it:
 * the rule names `@nestjs`, `typeorm`, `express`, `ioredis` and `bullmq`, and a language runtime
 * primitive is not a framework the layering exists to keep out. This file runs with no database,
 * no broker and no HTTP, which is the check CLAUDE.md actually states.
 *
 * §12.5.6 closed four properties and each is one line below: **≥ 256 bits from a CSPRNG**, **stored
 * SHA-256**, **compared in constant time**, **single-use** — the last enforced by the store, since
 * "used exactly once under concurrency" is a claim only the database can make.
 *
 * **The token is not a `uuidv7()`**, and §7.9 says so in terms: v7 encodes its own creation
 * timestamp, so a value whose whole job is to be unguessable would ship a predictable prefix.
 * That convention is the house default everywhere else, which is exactly why it is written down
 * here — this is the file where following the default would be the defect.
 */

/** 32 bytes = 256 bits, which is §12.5.6's floor rather than a round number. */
const TOKEN_BYTES = 32;

/** §12.5.6: email verification 24 h. A different object from OQ-52's 7-day account window. */
export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface IssuedVerificationToken {
  /**
   * The only place the raw value exists. It goes to the recipient and into the outbox payload
   * (OQ-54) and is never stored in `identity.verification_token`.
   */
  readonly value: string;
  /** What is stored, and what a reader of the table gets instead of something usable. */
  readonly hash: Buffer;
  readonly expiresAt: Date;
}

/**
 * base64url, because the value travels in a URL. Base64 proper would need percent-encoding, and a
 * token that survives one mail client's link rewriting and not another's is the kind of defect
 * that reproduces only for the person who reported it.
 */
export function issueVerificationToken(now: Date): IssuedVerificationToken {
  const value = randomBytes(TOKEN_BYTES).toString('base64url');
  return {
    value,
    hash: hashVerificationToken(value),
    expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
  };
}

export function hashVerificationToken(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * Constant-time comparison, as NFR-64 requires in terms.
 *
 * Worth being honest about what it buys here, so nobody removes it as ceremony or trusts it too
 * far. The store looks a token up **by** its hash, and an index probe already leaks nothing usable
 * — a hash is not invertible, so timing on it reveals nothing about the value that produced it.
 * This is the belt to that lookup's braces: it costs one comparison, it is what the requirement
 * says, and it keeps the property true if the lookup is ever rewritten to fetch a candidate row
 * and compare in application code, which is where a naive `===` would genuinely matter.
 *
 * `timingSafeEqual` throws on a length mismatch, which would itself be a timing signal — so the
 * lengths are checked first and a mismatch is simply "no".
 */
export function verificationTokenMatches(hashes: {
  readonly presented: Buffer;
  readonly stored: Buffer;
}): boolean {
  // Named rather than positional because both are `Buffer` (CLAUDE.md, "Conventions"). The
  // comparison itself is symmetric, so a swap would not change this answer — but the names are
  // what tell the next reader which side came from the request and which from the table, and
  // that distinction is the whole reason the comparison is constant-time.
  if (hashes.presented.length !== hashes.stored.length) return false;
  return timingSafeEqual(hashes.presented, hashes.stored);
}
