import {
  VERIFICATION_TOKEN_TTL_MS,
  hashVerificationToken,
  issueVerificationToken,
  verificationTokenMatches,
} from './verification-token';

/**
 * NFR-64's four properties for an externally visible token, and §7.9's rule that it must not be a
 * `uuidv7()`.
 */
describe('verification token (NFR-64, §12.5.6)', () => {
  const NOW = new Date('2026-08-20T09:00:00.000Z');

  it('carries at least 256 bits of entropy', () => {
    // base64url of 32 bytes, unpadded: ceil(32 * 8 / 6) = 43 characters. Asserting the decoded
    // length rather than the string length says what the requirement actually is.
    const { value } = issueVerificationToken(NOW);
    expect(Buffer.from(value, 'base64url')).toHaveLength(32);
  });

  it('is URL-safe, because it travels in a link', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(issueVerificationToken(NOW).value).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('does not repeat', () => {
    const values = new Set(
      Array.from({ length: 200 }, () => issueVerificationToken(NOW).value),
    );
    expect(values.size).toBe(200);
  });

  it('expires 24 hours after issue (§12.5.6)', () => {
    expect(issueVerificationToken(NOW).expiresAt.getTime() - NOW.getTime()).toBe(
      VERIFICATION_TOKEN_TTL_MS,
    );
    expect(VERIFICATION_TOKEN_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('stores a SHA-256 of the value and never the value', () => {
    const { value, hash } = issueVerificationToken(NOW);
    expect(hash).toHaveLength(32);
    expect(hash).toEqual(hashVerificationToken(value));
    expect(hash.toString('utf8')).not.toContain(value);
  });

  describe('comparison', () => {
    it('matches a hash against itself', () => {
      const hash = hashVerificationToken('a-token');
      expect(verificationTokenMatches({ presented: hash, stored: Buffer.from(hash) })).toBe(true);
    });

    it('rejects a different token', () => {
      expect(
        verificationTokenMatches({
          presented: hashVerificationToken('a'),
          stored: hashVerificationToken('b'),
        }),
      ).toBe(false);
    });

    // `timingSafeEqual` throws on a length mismatch, and a throw is itself a timing signal. This
    // is what proves the guard in front of it is there.
    it('returns false rather than throwing on a length mismatch', () => {
      expect(
        verificationTokenMatches({
          presented: Buffer.from('short'),
          stored: hashVerificationToken('a'),
        }),
      ).toBe(false);
    });
  });
});
