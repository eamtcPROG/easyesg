import { INVITATION_TOKEN_TTL_MS, hashInvitationToken, issueInvitationToken } from './invitation-token';

/**
 * §12.5.6's four token properties, asserted for the third and last token kind — the same four
 * `verification-token.spec.ts` pins, because a property restated in three files must be proven in
 * each or the restatement is decoration.
 */
describe('invitation token (FR-11, NFR-64, §12.5.6)', () => {
  const NOW = new Date('2026-08-25T09:00:00Z');

  it('is at least 256 bits of entropy', () => {
    // base64url of 32 bytes: 43 characters, unpadded. Asserting the decoded length rather than the
    // string length is what makes this a statement about entropy rather than about formatting.
    expect(Buffer.from(issueInvitationToken(NOW).value, 'base64url')).toHaveLength(32);
  });

  it('is unguessable rather than derived from the clock (§7.9)', () => {
    const values = new Set(
      Array.from({ length: 100 }, () => issueInvitationToken(NOW).value),
    );
    // A `uuidv7()` minted at one instant would collide or share a long prefix; this must not.
    expect(values.size).toBe(100);
  });

  it('stores the SHA-256 and never the value', () => {
    const token = issueInvitationToken(NOW);

    expect(token.hash).toHaveLength(32);
    expect(token.hash).toEqual(hashInvitationToken(token.value));
    expect(token.hash.toString('base64url')).not.toBe(token.value);
  });

  it('is URL-safe, because it travels as a path segment', () => {
    // `[locale]/(identity)/invitation/[token]` — so a value needing percent-encoding would be a
    // link that survives one mail client's rewriting and not another's.
    expect(issueInvitationToken(NOW).value).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('expires seven days after issue', () => {
    expect(issueInvitationToken(NOW).expiresAt.getTime()).toBe(
      NOW.getTime() + INVITATION_TOKEN_TTL_MS,
    );
    // Stated numerically as well, so a change to the constant has to be a deliberate one: this is
    // §12.5.6's value, not an arbitrary window.
    expect(INVITATION_TOKEN_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
