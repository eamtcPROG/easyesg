import {
  ADMIN_INVITATION_TOKEN_TTL_MS,
  hashAdminInvitationToken,
  issueAdminInvitationToken,
} from './admin-invitation-token';

describe('an administrator invitation token (task 67.4, §12.5.6)', () => {
  const now = new Date('2026-09-13T10:00:00Z');

  it('lives 24 hours from the moment it is issued', () => {
    expect(ADMIN_INVITATION_TOKEN_TTL_MS).toBe(86_400_000);
    expect(issueAdminInvitationToken(now).expiresAt.toISOString()).toBe('2026-09-14T10:00:00.000Z');
  });

  it('carries at least 256 bits, URL-safe', () => {
    const { value } = issueAdminInvitationToken(now);
    expect(Buffer.from(value, 'base64url')).toHaveLength(32);
    expect(value).toMatch(/^[A-Za-z0-9_-]+$/u);
  });

  it('is stored as the SHA-256 of the value, and two issues never share one', () => {
    const first = issueAdminInvitationToken(now);
    const second = issueAdminInvitationToken(now);

    expect(first.hash.equals(hashAdminInvitationToken(first.value))).toBe(true);
    expect(first.hash).toHaveLength(32);
    expect(first.value).not.toBe(second.value);
  });
});
