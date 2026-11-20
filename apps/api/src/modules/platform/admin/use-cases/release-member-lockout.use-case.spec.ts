import { LockedMemberNotFoundError, MemberNotLockedError } from '../errors/organization-register.errors';
import {
  MEMBER_LOCKOUT_RELEASE,
  type MemberLockoutRelease,
  type MemberLockoutReleaseOutcome,
  type MemberLockoutStore,
} from '../interfaces/member-lockout-store.interface';
import { ReleaseMemberLockout } from './release-member-lockout.use-case';

const AT = new Date('2026-11-18T10:00:00Z');
const COMMAND = {
  organizationId: '0190a000-0000-7000-8000-000000000001',
  accountId: '0190a000-0000-7000-8000-000000000002',
  requesterId: '0190a000-0000-7000-8000-000000000003',
  reason: 'The reset email does not reach the owner’s mailbox.',
};

const storeAnswering = (outcome: MemberLockoutReleaseOutcome) => {
  const asked: MemberLockoutRelease[] = [];
  const store: MemberLockoutStore = {
    release: (release) => {
      asked.push(release);
      return Promise.resolve(outcome);
    },
  };
  return { store, asked };
};

describe('ReleaseMemberLockout (task 67.12; FR-209)', () => {
  it('releases the named member at the clock’s time, as the operator', async () => {
    const { store, asked } = storeAnswering(MEMBER_LOCKOUT_RELEASE.RELEASED);
    await new ReleaseMemberLockout(store, () => AT).execute(COMMAND);
    expect(asked).toEqual([
      { organizationId: COMMAND.organizationId, accountId: COMMAND.accountId, requesterId: COMMAND.requesterId, at: AT },
    ]);
  });

  it('refuses an account that is not locked, so no audit row records a release that did not happen', async () => {
    const { store } = storeAnswering(MEMBER_LOCKOUT_RELEASE.NOT_LOCKED);
    await expect(new ReleaseMemberLockout(store, () => AT).execute(COMMAND)).rejects.toBeInstanceOf(
      MemberNotLockedError,
    );
  });

  it('refuses an account that is not the organization’s member', async () => {
    const { store } = storeAnswering(MEMBER_LOCKOUT_RELEASE.NOT_A_MEMBER);
    await expect(new ReleaseMemberLockout(store, () => AT).execute(COMMAND)).rejects.toBeInstanceOf(
      LockedMemberNotFoundError,
    );
  });
});
