import { MEMBERSHIP_ROLE, REPORT_STATUS } from '@easyesg/contracts';
import { describe, expect, it, vi } from 'vitest';
import { READ_ONLY_CAUSE, readOnlyCauseOf } from './wizard';

// Throws outside a React Server environment by design; `api-client.spec.ts` records the same.
vi.mock('server-only', () => ({}));

/**
 * UX-13's cause, as a rule (task 35.2): which of the reachable causes S-07 names, and that the lock
 * outranks the role — task 31.2's "the lock is not a role gate", restated at the screen.
 */
describe('readOnlyCauseOf', () => {
  it('names the lock even for a viewer, the role for an open report, and nothing for an editor', () => {
    expect(
      readOnlyCauseOf({ report: { status: REPORT_STATUS.LOCKED }, role: MEMBERSHIP_ROLE.VIEWER }),
    ).toBe(READ_ONLY_CAUSE.LOCKED);
    expect(
      readOnlyCauseOf({
        report: { status: REPORT_STATUS.LOCKED },
        role: MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR,
      }),
    ).toBe(READ_ONLY_CAUSE.LOCKED);
    expect(
      readOnlyCauseOf({ report: { status: REPORT_STATUS.OPEN }, role: MEMBERSHIP_ROLE.VIEWER }),
    ).toBe(READ_ONLY_CAUSE.VIEWER);
    expect(
      readOnlyCauseOf({ report: { status: REPORT_STATUS.OPEN }, role: MEMBERSHIP_ROLE.EDITOR }),
    ).toBeNull();
    // No membership resolved is not "viewer": the API is the authority on the role, and a screen
    // that could not read it must not invent one.
    expect(readOnlyCauseOf({ report: { status: REPORT_STATUS.OPEN }, role: null })).toBeNull();
  });
});
