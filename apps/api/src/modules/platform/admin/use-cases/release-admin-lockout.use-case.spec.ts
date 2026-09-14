import { AdminAccountNotFoundError, AdminAccountNotLockedError } from '../errors/admin-accounts.errors';
import { ADMIN_ACCOUNT_STATUS } from '../models/admin-session.model';
import { FakeAdminRealm } from '../testing/admin-realm.fake';
import { ReleaseAdminLockout } from './release-admin-lockout.use-case';

const NOW = new Date('2026-09-13T10:00:00Z');
const LOCKED_AT = new Date('2026-09-13T09:40:00Z');

describe('ReleaseAdminLockout (task 67.4)', () => {
  it('releases a locked account', async () => {
    const realm = new FakeAdminRealm();
    const locked = realm.seedAccount({ email: 'locked@easyesg.md', lockedAt: LOCKED_AT });

    await new ReleaseAdminLockout(realm.accountStore, () => NOW).execute({ accountId: locked.id });

    expect(realm.accountById(locked.id)?.lockedAt).toBeNull();
  });

  it('refuses an account that is not locked, rather than recording a release that did not happen', async () => {
    const realm = new FakeAdminRealm();
    const open = realm.seedAccount({ email: 'open@easyesg.md' });

    await expect(
      new ReleaseAdminLockout(realm.accountStore, () => NOW).execute({ accountId: open.id }),
    ).rejects.toBeInstanceOf(AdminAccountNotLockedError);
  });

  it('releases nothing on a removed account, which accepts no change at all', async () => {
    const realm = new FakeAdminRealm();
    const removed = realm.seedAccount({
      email: 'removed@easyesg.md',
      status: ADMIN_ACCOUNT_STATUS.REMOVED,
      lockedAt: LOCKED_AT,
    });

    await expect(
      new ReleaseAdminLockout(realm.accountStore, () => NOW).execute({ accountId: removed.id }),
    ).rejects.toBeInstanceOf(AdminAccountNotLockedError);
    expect(realm.accountById(removed.id)?.lockedAt).toEqual(LOCKED_AT);
  });

  it('refuses an account that does not exist', async () => {
    await expect(
      new ReleaseAdminLockout(new FakeAdminRealm().accountStore, () => NOW).execute({
        accountId: '01920000-0000-7000-8000-00000000dead',
      }),
    ).rejects.toBeInstanceOf(AdminAccountNotFoundError);
  });
});
