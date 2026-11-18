import { CONSOLE_ROLES } from '@api/infrastructure/persistence/migrations/1793750400000-console-roles';
import {
  ADMIN_PERMISSION,
  CONSOLE_ROLE,
  CONSOLE_ROLE_PERMISSIONS,
  orderedConsoleRoles,
  permissionsOf,
} from './console-role.model';

describe('the console role catalogue (task 67.13; FR-80, 182/3)', () => {
  const OPERATIONS_AND_SUPPORT = [
    ...CONSOLE_ROLE_PERMISSIONS[CONSOLE_ROLE.OPERATIONS],
    ...CONSOLE_ROLE_PERMISSIONS[CONSOLE_ROLE.SUPPORT],
  ];

  it('gives the content roles no operations or support permission (FR-80 AC-8)', () => {
    for (const role of [CONSOLE_ROLE.CONTENT_AUTHOR, CONSOLE_ROLE.CONTENT_PUBLISHER]) {
      expect(CONSOLE_ROLE_PERMISSIONS[role].filter((p) => OPERATIONS_AND_SUPPORT.includes(p))).toEqual([]);
    }
  });

  it('lets every role together hold every permission, which is what the migration gives existing accounts', () => {
    expect(permissionsOf(Object.values(CONSOLE_ROLE))).toEqual(Object.values(ADMIN_PERMISSION));
  });

  it('keeps the migration’s copy of the vocabulary — the database’s CHECK — equal to this one', () => {
    expect([...CONSOLE_ROLES]).toEqual(Object.values(CONSOLE_ROLE));
  });

  it('answers each permission once, in the vocabulary’s order, however the roles were listed', () => {
    expect(permissionsOf([CONSOLE_ROLE.CONTENT_PUBLISHER, CONSOLE_ROLE.CONTENT_AUTHOR])).toEqual([
      ADMIN_PERMISSION.CONTENT_EDIT,
      ADMIN_PERMISSION.CONTENT_PUBLISH,
    ]);
    expect(permissionsOf([])).toEqual([]);
  });

  it('orders a role set by the vocabulary and drops repeats', () => {
    expect(orderedConsoleRoles([CONSOLE_ROLE.SUPPORT, CONSOLE_ROLE.ACCOUNT_ADMINISTRATION, CONSOLE_ROLE.SUPPORT])).toEqual([
      CONSOLE_ROLE.ACCOUNT_ADMINISTRATION,
      CONSOLE_ROLE.SUPPORT,
    ]);
  });
});
