import { describe, expect, it } from 'vitest';
import { readFactorCommand, readPasswordCommand } from './reauthentication-command';

/** The handlers' only trust boundary on their input (task 92): what is not the shape is `null`, never a guess. */
const password = {
  accountId: 'account-1',
  email: 'ana@example.md',
  password: 'Parola123!',
  remembered: true,
  organizationId: 'organization-1',
};

describe('readPasswordCommand', () => {
  it('reads a whole submission, and an organization the page had none of', () => {
    expect(readPasswordCommand(password)).toEqual(password);
    expect(readPasswordCommand({ ...password, organizationId: null })).toEqual({ ...password, organizationId: null });
  });

  it('refuses a body missing any part, or carrying one of the wrong kind', () => {
    expect(readPasswordCommand(null)).toBeNull();
    expect(readPasswordCommand('ana@example.md')).toBeNull();
    for (const key of Object.keys(password)) {
      const rest = Object.fromEntries(Object.entries(password).filter(([name]) => name !== key));
      expect(readPasswordCommand(rest)).toBeNull();
    }
    expect(readPasswordCommand({ ...password, password: '' })).toBeNull();
    expect(readPasswordCommand({ ...password, remembered: 'true' })).toBeNull();
    expect(readPasswordCommand({ ...password, organizationId: '' })).toBeNull();
  });
});

describe('readFactorCommand', () => {
  const code = { accountId: 'account-1', code: '123456', organizationId: null };

  it('reads a code submission', () => {
    expect(readFactorCommand(code)).toEqual(code);
  });

  it('refuses a missing code, an empty one, or no account to check it against', () => {
    expect(readFactorCommand({ ...code, code: '' })).toBeNull();
    expect(readFactorCommand({ code: '123456', organizationId: null })).toBeNull();
    expect(readFactorCommand({ accountId: 'account-1', code: '123456' })).toBeNull();
  });
});
