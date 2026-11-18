import { ADMIN_ROLE } from '../models/admin-session.model';
import { CONSOLE_ROLE } from '../models/console-role.model';
import { consoleRolesFitRealm } from './console-role-assignment';

describe('consoleRolesFitRealm (task 67.13; FR-80 AC-9)', () => {
  it('asks one or more roles of a Platform Administrator', () => {
    expect(consoleRolesFitRealm({ realm: ADMIN_ROLE.PLATFORM_ADMINISTRATOR, roles: [CONSOLE_ROLE.SUPPORT] })).toBe(true);
    expect(consoleRolesFitRealm({ realm: ADMIN_ROLE.PLATFORM_ADMINISTRATOR, roles: [] })).toBe(false);
  });

  it('gives a Billing Operator none, the realm being its authority', () => {
    expect(consoleRolesFitRealm({ realm: ADMIN_ROLE.BILLING_OPERATOR, roles: [] })).toBe(true);
    expect(consoleRolesFitRealm({ realm: ADMIN_ROLE.BILLING_OPERATOR, roles: [CONSOLE_ROLE.SUPPORT] })).toBe(false);
  });
});
