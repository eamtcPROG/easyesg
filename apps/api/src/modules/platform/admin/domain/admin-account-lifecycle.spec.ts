import { ADMIN_ACCOUNT_STATUS, ADMIN_ROLE } from '../models/admin-session.model';
import { ADMIN_ACCOUNT_CHANGE } from '../models/admin-account-change.model';
import {
  adminAccountChangeApplies,
  sessionRevocationFor,
  statusAfterAdminAccountChange,
  wouldLeaveNoPlatformAdministrator,
} from './admin-account-lifecycle';

describe('an administrator account’s lifecycle (task 67.4, FR-80)', () => {
  it('suspends only an active account, and reactivates only a suspended one', () => {
    expect(adminAccountChangeApplies({ change: 'suspend', status: 'active' })).toBe(true);
    expect(adminAccountChangeApplies({ change: 'suspend', status: 'suspended' })).toBe(false);
    expect(adminAccountChangeApplies({ change: 'reactivate', status: 'suspended' })).toBe(true);
    expect(adminAccountChangeApplies({ change: 'reactivate', status: 'active' })).toBe(false);
  });

  it('removes an active or a suspended account, and nothing applies to a removed one — removal is final', () => {
    expect(adminAccountChangeApplies({ change: 'remove', status: 'active' })).toBe(true);
    expect(adminAccountChangeApplies({ change: 'remove', status: 'suspended' })).toBe(true);
    for (const change of Object.values(ADMIN_ACCOUNT_CHANGE)) {
      expect(adminAccountChangeApplies({ change, status: 'removed' })).toBe(false);
    }
  });

  it('lands each change on its own status', () => {
    expect(statusAfterAdminAccountChange('suspend')).toBe('suspended');
    expect(statusAfterAdminAccountChange('reactivate')).toBe('active');
    expect(statusAfterAdminAccountChange('remove')).toBe('removed');
  });

  it('ends the sessions on suspension and removal, and revives none on reactivation', () => {
    expect(sessionRevocationFor('suspend')).toBe('account_suspended');
    expect(sessionRevocationFor('remove')).toBe('account_removed');
    expect(sessionRevocationFor('reactivate')).toBeNull();
  });

  describe('the last active Platform Administrator', () => {
    const lastAdministrator = {
      account: { role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR, status: ADMIN_ACCOUNT_STATUS.ACTIVE },
      activePlatformAdministrators: 1,
    };

    it('cannot be suspended or removed', () => {
      expect(wouldLeaveNoPlatformAdministrator({ ...lastAdministrator, change: 'suspend' })).toBe(true);
      expect(wouldLeaveNoPlatformAdministrator({ ...lastAdministrator, change: 'remove' })).toBe(true);
    });

    it('can be, once a second one is active', () => {
      expect(
        wouldLeaveNoPlatformAdministrator({
          ...lastAdministrator,
          activePlatformAdministrators: 2,
          change: 'remove',
        }),
      ).toBe(false);
    });

    it('is not what a Billing Operator, a suspended administrator or a reactivation is judged against', () => {
      expect(
        wouldLeaveNoPlatformAdministrator({
          ...lastAdministrator,
          account: { role: ADMIN_ROLE.BILLING_OPERATOR, status: ADMIN_ACCOUNT_STATUS.ACTIVE },
          change: 'remove',
        }),
      ).toBe(false);
      expect(
        wouldLeaveNoPlatformAdministrator({
          ...lastAdministrator,
          account: { role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR, status: ADMIN_ACCOUNT_STATUS.SUSPENDED },
          change: 'remove',
        }),
      ).toBe(false);
      expect(wouldLeaveNoPlatformAdministrator({ ...lastAdministrator, change: 'reactivate' })).toBe(false);
    });
  });
});
