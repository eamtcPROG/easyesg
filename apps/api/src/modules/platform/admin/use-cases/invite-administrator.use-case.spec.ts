import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import { hashAdminInvitationToken } from '../domain/admin-invitation-token';
import { AdminAccountExistsError } from '../errors/admin-accounts.errors';
import { AdminInvitationOutstandingError } from '../errors/admin-invitation.errors';
import { ADMIN_INVITATION_STATUS } from '../models/admin-invitation.model';
import { ADMIN_ACCOUNT_STATUS, ADMIN_ROLE } from '../models/admin-session.model';
import { FakeAdminRealm } from '../testing/admin-realm.fake';
import { InviteAdministrator } from './invite-administrator.use-case';

const NOW = new Date('2026-09-13T10:00:00Z');
const OPERATOR = '01920000-0000-7000-8000-0000000000aa';

const build = (realm: FakeAdminRealm) => new InviteAdministrator(realm.accountStore, () => NOW);

const invite = (realm: FakeAdminRealm, email = 'Nou.Operator@EasyESG.md') =>
  build(realm).execute({ email, role: ADMIN_ROLE.BILLING_OPERATOR, invitedBy: OPERATOR });

describe('InviteAdministrator (task 67.4, UC-87)', () => {
  it('invites the normalised address for 24 hours, and the link it mails is the only copy of the token', async () => {
    const realm = new FakeAdminRealm();

    const invitation = await invite(realm);

    expect(invitation).toMatchObject({
      email: 'nou.operator@easyesg.md',
      role: 'billing_operator',
      status: 'pending',
      expiresAt: new Date('2026-09-14T10:00:00Z'),
    });
    expect(realm.invitations[0].invitedBy).toBe(OPERATOR);
    expect(realm.emails).toHaveLength(1);
    const [{ event }] = realm.emails;
    expect(event).toMatchObject({ invitationId: invitation.id, email: 'nou.operator@easyesg.md' });
    // Stored as its hash; the raw value travels in the email's payload alone.
    expect(realm.invitations[0].tokenHash.equals(hashAdminInvitationToken(event.token))).toBe(true);
  });

  it('refuses an address an active or a suspended account holds', async () => {
    for (const status of [ADMIN_ACCOUNT_STATUS.ACTIVE, ADMIN_ACCOUNT_STATUS.SUSPENDED]) {
      const realm = new FakeAdminRealm();
      realm.seedAccount({ email: 'nou.operator@easyesg.md', status });

      await expect(invite(realm)).rejects.toBeInstanceOf(AdminAccountExistsError);
      expect(realm.invitations).toEqual([]);
      expect(realm.emails).toEqual([]);
    }
  });

  it('invites a removed account’s address anew — removal is final, and the address is free', async () => {
    const realm = new FakeAdminRealm();
    realm.seedAccount({ email: 'nou.operator@easyesg.md', status: ADMIN_ACCOUNT_STATUS.REMOVED });

    await expect(invite(realm)).resolves.toMatchObject({ status: 'pending' });
  });

  it('refuses a second pending invitation to the address, naming the one outstanding', async () => {
    const realm = new FakeAdminRealm();
    await invite(realm);

    await expect(invite(realm)).rejects.toBeInstanceOf(AdminInvitationOutstandingError);
    expect(realm.emails).toHaveLength(1);
  });

  it('spends nothing on a refused collision — no mail left, so the address keeps its budget', async () => {
    const realm = new FakeAdminRealm();
    realm.seedAccount({ email: 'nou.operator@easyesg.md' });

    await expect(invite(realm)).rejects.toBeInstanceOf(AdminAccountExistsError);
    expect(realm.attempts).toEqual([]);
  });

  it('sends at most five invitation emails to one address in the window, whoever revoked what in between', async () => {
    const realm = new FakeAdminRealm();
    const revokeAll = () => {
      realm.invitations = realm.invitations.map((invitation) => ({
        ...invitation,
        status: ADMIN_INVITATION_STATUS.REVOKED,
      }));
    };

    for (let sent = 0; sent < 5; sent += 1) {
      await invite(realm);
      revokeAll();
    }

    await expect(invite(realm)).rejects.toBeInstanceOf(AuthRateLimitedError);
    expect(realm.emails).toHaveLength(5);
    // Another address has its own window.
    await expect(invite(realm, 'altul@easyesg.md')).resolves.toMatchObject({ status: 'pending' });
  });
});
