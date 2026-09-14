import { describe, expect, it } from 'vitest';
import { SYSTEM_AUDIT_ACTION } from '@easyesg/contracts';
import ro from '~/messages/ro.json';
import { LOG_ACTION_LABEL, logOperatorOf } from './log-labels';

describe('A-08’s log labels (task 67.4)', () => {
  it('labels every action the log can hold, each from the catalogue', () => {
    const actions: Record<string, string> = ro.platform.accounts.log.actions;
    for (const action of Object.values(SYSTEM_AUDIT_ACTION)) {
      expect(actions[LOG_ACTION_LABEL[action]]).toEqual(expect.any(String));
    }
    expect(new Set(Object.values(LOG_ACTION_LABEL)).size).toBe(Object.values(SYSTEM_AUDIT_ACTION).length);
  });

  it('names an operator by their address, and says who acted where no account did', () => {
    expect(
      logOperatorOf({ action: 'admin.account.suspended', actorId: 'id', actorEmail: 'ana@easyesg.md' }),
    ).toEqual({ kind: 'account', email: 'ana@easyesg.md' });
    expect(logOperatorOf({ action: 'admin.account.suspended', actorId: 'id', actorEmail: null })).toEqual({
      kind: 'former',
    });
    expect(logOperatorOf({ action: 'admin.account.provisioned', actorId: null, actorEmail: null })).toEqual({
      kind: 'provisioning',
    });
    expect(logOperatorOf({ action: 'admin.account.lockout_released', actorId: null, actorEmail: null })).toEqual({
      kind: 'provisioning',
    });
    expect(
      logOperatorOf({ action: 'admin.sign_in.credential_refused', actorId: null, actorEmail: null }),
    ).toEqual({ kind: 'unknown_address' });
  });
});
