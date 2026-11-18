import { ADMIN_PERMISSION, ADMIN_ROLE, CONSOLE_ROLE } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { operatorOf } from './console-operator';

describe('operatorOf (task 67.13)', () => {
  it('keeps the account and carries the roles and permissions beside it', () => {
    expect(
      operatorOf({
        account: { id: 'a', email: 'pa@easyesg.md', role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR },
        consoleRoles: [CONSOLE_ROLE.CONTENT_AUTHOR],
        permissions: [ADMIN_PERMISSION.CONTENT_EDIT],
      }),
    ).toEqual({
      id: 'a',
      email: 'pa@easyesg.md',
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
      consoleRoles: [CONSOLE_ROLE.CONTENT_AUTHOR],
      permissions: [ADMIN_PERMISSION.CONTENT_EDIT],
    });
  });
});
