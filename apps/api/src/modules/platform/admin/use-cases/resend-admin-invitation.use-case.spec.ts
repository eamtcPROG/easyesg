import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import { hashAdminInvitationToken } from '../domain/admin-invitation-token';
import { AdminInvitationNotFoundError } from '../errors/admin-invitation.errors';
import { ADMIN_INVITATION_STATUS } from '../models/admin-invitation.model';
import { ADMIN_ROLE } from '../models/admin-session.model';
import { FakeAdminRealm } from '../testing/admin-realm.fake';
import { InviteAdministrator } from './invite-administrator.use-case';
import { ResendAdminInvitation } from './resend-admin-invitation.use-case';

const SENT = new Date('2026-09-13T10:00:00Z');
const LATER = new Date('2026-09-15T09:00:00Z');

const sendOne = async (realm: FakeAdminRealm) =>
  new InviteAdministrator(realm.accountStore, () => SENT).execute({
    email: 'operator@easyesg.md',
    role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    invitedBy: '01920000-0000-7000-8000-0000000000aa',
  });

describe('ResendAdminInvitation (task 67.4)', () => {
  it('replaces the link, restarts the 24 hours from now, and drops a factor the old link staged', async () => {
    const realm = new FakeAdminRealm();
    const invitation = await sendOne(realm);
    const firstToken = realm.emails[0].event.token;
    realm.invitations = realm.invitations.map((candidate) => ({
      ...candidate,
      stagedTotpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
    }));

    // Lapsed by now — a resend is how a lapsed invitation comes back.
    await new ResendAdminInvitation(realm.accountStore, () => LATER).execute({ invitationId: invitation.id });

    const [resent] = realm.invitations;
    const secondToken = realm.emails[1].event.token;
    expect(resent.expiresAt).toEqual(new Date('2026-09-16T09:00:00Z'));
    expect(resent.stagedTotpSecret).toBeNull();
    expect(resent.tokenHash.equals(hashAdminInvitationToken(secondToken))).toBe(true);
    expect(resent.tokenHash.equals(hashAdminInvitationToken(firstToken))).toBe(false);
    // The same invitation, not a second one.
    expect(realm.invitations).toHaveLength(1);
  });

  it('refuses an invitation that is no longer pending', async () => {
    const realm = new FakeAdminRealm();
    const invitation = await sendOne(realm);
    realm.invitations = realm.invitations.map((candidate) => ({
      ...candidate,
      status: ADMIN_INVITATION_STATUS.REVOKED,
    }));

    await expect(
      new ResendAdminInvitation(realm.accountStore, () => LATER).execute({ invitationId: invitation.id }),
    ).rejects.toBeInstanceOf(AdminInvitationNotFoundError);
    expect(realm.emails).toHaveLength(1);
  });

  it('spends the address’s window, which the issue already started', async () => {
    const realm = new FakeAdminRealm();
    const invitation = await sendOne(realm);
    const resend = new ResendAdminInvitation(realm.accountStore, () => SENT);

    for (let sent = 1; sent < 5; sent += 1) await resend.execute({ invitationId: invitation.id });

    await expect(resend.execute({ invitationId: invitation.id })).rejects.toBeInstanceOf(
      AuthRateLimitedError,
    );
    expect(realm.emails).toHaveLength(5);
  });
});
