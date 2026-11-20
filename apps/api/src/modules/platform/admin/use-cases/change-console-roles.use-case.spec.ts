import {
  AdminAccountNotFoundError,
  ConsoleRolesInvalidError,
  ConsoleRolesNotApplicableError,
  ConsoleRolesSelfError,
} from '../errors/admin-accounts.errors';
import { ADMIN_ACCOUNT_STATUS, ADMIN_ROLE } from '../models/admin-session.model';
import { CONSOLE_ROLE } from '../models/console-role.model';
import { FakeAdminRealm } from '../testing/admin-realm.fake';
import { ChangeConsoleRoles } from './change-console-roles.use-case';

const NOW = new Date('2026-11-18T10:00:00Z');

const setUp = () => {
  const realm = new FakeAdminRealm();
  const operator = realm.seedAccount({ email: 'admin@easyesg.md', consoleRoles: Object.values(CONSOLE_ROLE) });
  const colleague = realm.seedAccount({ email: 'colleague@easyesg.md', consoleRoles: [CONSOLE_ROLE.SUPPORT] });
  const change = (input: { accountId: string; roles: (typeof CONSOLE_ROLE)[keyof typeof CONSOLE_ROLE][] }) =>
    new ChangeConsoleRoles(realm.accountStore, () => NOW).execute({ ...input, operatorId: operator.id });
  const rolesOf = (id: string) => realm.accounts.find((account) => account.id === id)?.consoleRoles;
  return { realm, operator, colleague, change, rolesOf };
};

describe('ChangeConsoleRoles (task 67.13; FR-80 behaviour 10, AC-9)', () => {
  it('replaces another administrator’s roles with the set given, in the vocabulary’s order', async () => {
    const { colleague, change, rolesOf } = setUp();
    await change({ accountId: colleague.id, roles: [CONSOLE_ROLE.CONTENT_AUTHOR, CONSOLE_ROLE.ACCOUNT_ADMINISTRATION] });
    expect(rolesOf(colleague.id)).toEqual([CONSOLE_ROLE.ACCOUNT_ADMINISTRATION, CONSOLE_ROLE.CONTENT_AUTHOR]);
  });

  it('refuses the operator’s own account, leaving its roles as they were', async () => {
    const { operator, change, rolesOf } = setUp();
    await expect(change({ accountId: operator.id, roles: [CONSOLE_ROLE.SUPPORT] })).rejects.toBeInstanceOf(
      ConsoleRolesSelfError,
    );
    expect(rolesOf(operator.id)).toEqual(Object.values(CONSOLE_ROLE));
  });

  it('refuses no role at all', async () => {
    const { colleague, change, rolesOf } = setUp();
    await expect(change({ accountId: colleague.id, roles: [] })).rejects.toBeInstanceOf(ConsoleRolesInvalidError);
    expect(rolesOf(colleague.id)).toEqual([CONSOLE_ROLE.SUPPORT]);
  });

  it('refuses a Billing Operator’s account and a removed one', async () => {
    const { realm, change } = setUp();
    const billing = realm.seedAccount({ email: 'billing@easyesg.md', role: ADMIN_ROLE.BILLING_OPERATOR });
    const removed = realm.seedAccount({ email: 'gone@easyesg.md', status: ADMIN_ACCOUNT_STATUS.REMOVED });
    for (const account of [billing, removed]) {
      await expect(change({ accountId: account.id, roles: [CONSOLE_ROLE.SUPPORT] })).rejects.toBeInstanceOf(
        ConsoleRolesNotApplicableError,
      );
    }
  });

  it('refuses an account the realm does not hold', async () => {
    const { change } = setUp();
    await expect(
      change({ accountId: '01920000-0000-7000-8000-0000000000ff', roles: [CONSOLE_ROLE.SUPPORT] }),
    ).rejects.toBeInstanceOf(AdminAccountNotFoundError);
  });
});
