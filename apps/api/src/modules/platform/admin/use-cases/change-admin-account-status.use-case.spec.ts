import { ADMIN_ACCOUNT_CHANGE } from '../models/admin-account-change.model';
import {
  AdminAccountChangeRefusedError,
  AdminAccountNotFoundError,
  AdminAccountSelfError,
  LastPlatformAdministratorError,
} from '../errors/admin-accounts.errors';
import {
  ADMIN_ACCOUNT_STATUS,
  ADMIN_ROLE,
  ADMIN_SESSION_REVOKED_REASON,
} from '../models/admin-session.model';
import { FakeAdminRealm } from '../testing/admin-realm.fake';
import { ChangeAdminAccountStatus } from './change-admin-account-status.use-case';

const NOW = new Date('2026-09-13T10:00:00Z');
const EARLIER = new Date('2026-09-12T10:00:00Z');

const realmWithTwoAdministrators = () => {
  const realm = new FakeAdminRealm();
  const acting = realm.seedAccount({ email: 'acting@easyesg.md' });
  const target = realm.seedAccount({ email: 'target@easyesg.md' });
  return { realm, acting, target };
};

const change = (realm: FakeAdminRealm) => new ChangeAdminAccountStatus(realm.accountStore, () => NOW);

describe('ChangeAdminAccountStatus (task 67.4, FR-80)', () => {
  it('suspends an active account and ends its live sessions, leaving an ended session’s reason alone', async () => {
    const { realm, acting, target } = realmWithTwoAdministrators();
    const live = realm.seedSession(target.id);
    const ended = realm.seedSession(target.id, {
      at: EARLIER,
      reason: ADMIN_SESSION_REVOKED_REASON.SIGNED_OUT,
    });
    const someoneElses = realm.seedSession(acting.id);

    await change(realm).execute({
      accountId: target.id,
      change: ADMIN_ACCOUNT_CHANGE.SUSPEND,
      actingAccountId: acting.id,
    });

    expect(realm.accountById(target.id)?.status).toBe('suspended');
    const byId = (id: string) => realm.sessions.find((session) => session.id === id);
    expect(byId(live.id)).toMatchObject({ revokedAt: NOW, revokedReason: 'account_suspended' });
    expect(byId(ended.id)).toMatchObject({ revokedAt: EARLIER, revokedReason: 'signed_out' });
    expect(byId(someoneElses.id)).toMatchObject({ revokedAt: null });
  });

  it('reactivates a suspended account, and no session the suspension ended comes back', async () => {
    const { realm, acting, target } = realmWithTwoAdministrators();
    realm.seedSession(target.id);
    const run = change(realm);

    await run.execute({ accountId: target.id, change: ADMIN_ACCOUNT_CHANGE.SUSPEND, actingAccountId: acting.id });
    await run.execute({ accountId: target.id, change: ADMIN_ACCOUNT_CHANGE.REACTIVATE, actingAccountId: acting.id });

    expect(realm.accountById(target.id)?.status).toBe('active');
    expect(realm.sessions.every((session) => session.revokedReason === 'account_suspended')).toBe(true);
  });

  it('removes an account finally: its sessions end, and no change applies to it afterwards', async () => {
    const { realm, acting, target } = realmWithTwoAdministrators();
    realm.seedSession(target.id);
    const run = change(realm);

    await run.execute({ accountId: target.id, change: ADMIN_ACCOUNT_CHANGE.REMOVE, actingAccountId: acting.id });

    expect(realm.accountById(target.id)?.status).toBe('removed');
    expect(realm.sessions[0]).toMatchObject({ revokedReason: 'account_removed' });
    for (const next of Object.values(ADMIN_ACCOUNT_CHANGE)) {
      await expect(
        run.execute({ accountId: target.id, change: next, actingAccountId: acting.id }),
      ).rejects.toBeInstanceOf(AdminAccountChangeRefusedError);
    }
  });

  it('names what was refused by the change asked for, not by a generic failure', async () => {
    const { realm, acting, target } = realmWithTwoAdministrators();

    await expect(
      change(realm).execute({
        accountId: target.id,
        change: ADMIN_ACCOUNT_CHANGE.REACTIVATE,
        actingAccountId: acting.id,
      }),
    ).rejects.toMatchObject({ messageKey: 'platform.admin.account_change.reactivate' });
  });

  it('refuses the operator’s own account', async () => {
    const { realm, acting } = realmWithTwoAdministrators();

    await expect(
      change(realm).execute({
        accountId: acting.id,
        change: ADMIN_ACCOUNT_CHANGE.SUSPEND,
        actingAccountId: acting.id,
      }),
    ).rejects.toBeInstanceOf(AdminAccountSelfError);
    expect(realm.accountById(acting.id)?.status).toBe('active');
  });

  it('refuses to suspend or remove the last active Platform Administrator, and allows it while another is active', async () => {
    const realm = new FakeAdminRealm();
    const only = realm.seedAccount({ email: 'only@easyesg.md' });
    realm.seedAccount({ email: 'suspended@easyesg.md', status: ADMIN_ACCOUNT_STATUS.SUSPENDED });
    realm.seedAccount({ email: 'billing@easyesg.md', role: ADMIN_ROLE.BILLING_OPERATOR });
    // An operator no longer holding an account — the count, not the caller, is what the rule reads.
    const caller = '01920000-0000-7000-8000-0000000000ff';

    for (const next of [ADMIN_ACCOUNT_CHANGE.SUSPEND, ADMIN_ACCOUNT_CHANGE.REMOVE]) {
      await expect(
        change(realm).execute({ accountId: only.id, change: next, actingAccountId: caller }),
      ).rejects.toBeInstanceOf(LastPlatformAdministratorError);
    }

    realm.seedAccount({ email: 'second@easyesg.md' });
    await change(realm).execute({ accountId: only.id, change: ADMIN_ACCOUNT_CHANGE.SUSPEND, actingAccountId: caller });
    expect(realm.accountById(only.id)?.status).toBe('suspended');
  });

  it('refuses an account that does not exist', async () => {
    const { realm, acting } = realmWithTwoAdministrators();

    await expect(
      change(realm).execute({
        accountId: '01920000-0000-7000-8000-00000000dead',
        change: ADMIN_ACCOUNT_CHANGE.REMOVE,
        actingAccountId: acting.id,
      }),
    ).rejects.toBeInstanceOf(AdminAccountNotFoundError);
  });
});
