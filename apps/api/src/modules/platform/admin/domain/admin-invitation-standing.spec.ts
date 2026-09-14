import { ADMIN_INVITATION_STATUS } from '../models/admin-invitation.model';
import { adminInvitationStandingOf } from './admin-invitation-standing';

describe('an administrator invitation’s standing (task 67.4, A-20)', () => {
  const now = new Date('2026-09-13T10:00:00Z');
  const later = new Date('2026-09-14T10:00:00Z');
  const pending = { status: ADMIN_INVITATION_STATUS.PENDING, expiresAt: later };

  it('is acceptable while pending and before its expiry', () => {
    expect(adminInvitationStandingOf(pending, now)).toBe('acceptable');
  });

  it('has expired at the expiry instant itself, not a millisecond later', () => {
    expect(adminInvitationStandingOf(pending, later)).toBe('expired');
  });

  it('names a withdrawal and a use apart from a lapse, whatever the clock says', () => {
    expect(adminInvitationStandingOf({ ...pending, status: ADMIN_INVITATION_STATUS.REVOKED }, now)).toBe(
      'revoked',
    );
    expect(
      adminInvitationStandingOf({ ...pending, status: ADMIN_INVITATION_STATUS.ACCEPTED }, later),
    ).toBe('accepted');
  });

  it('reads a token that resolves to nothing as unknown — never issued, or replaced by a resend', () => {
    expect(adminInvitationStandingOf(null, now)).toBe('unknown');
  });
});
