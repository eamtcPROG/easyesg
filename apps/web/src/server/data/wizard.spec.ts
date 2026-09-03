import { MEMBERSHIP_ROLE, REPORT_STATUS } from '@easyesg/contracts';
import { describe, expect, it, vi } from 'vitest';
import { READ_ONLY_CAUSE, readOnlyCauseOf, resumeModule } from './wizard';

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

/**
 * Where a returning reporter lands (task 35.3): work last happened, else first incomplete, else
 * first — the rule that reconciles FR-39's position with UX-10's entry.
 */
describe('resumeModule', () => {
  const summary = (module: string, answered: number, lastAnsweredAt: number | null, total = 3) => ({
    module,
    answered,
    total,
    lastAnsweredAt,
    // FR-28's applicability reaches the list since task 91.3. A module the rules ruled out counts
    // no elements on either side, which is what the `total` argument stands in for below.
    applicable: total > 0,
    applicabilityCause: null,
  });

  it('prefers the module with the most recent answer, wherever it sits in the order', () => {
    const modules = [summary('B1', 1, 10), summary('B2', 0, null), summary('B3', 2, 500), summary('B4', 3, 200)];
    // B4 is complete and B1 is first: neither wins, because B3 is where work stopped.
    expect(resumeModule(modules)).toBe('B3');
  });

  it('gives a tie to the earlier module in the standard’s order', () => {
    // One queue flush spanning two modules stamps both with the transaction's `now()`.
    expect(resumeModule([summary('B1', 0, null), summary('B3', 1, 500), summary('B7', 1, 500)])).toBe('B3');
  });

  it('does not land a returning reporter on a module FR-28 ruled out (task 91.3)', () => {
    // An inapplicable module has nothing to answer, so `answered < total` is false for it and it
    // is never the first incomplete one — which is why this needed no rule of its own.
    expect(resumeModule([summary('B1', 3, null), summary('B6', 0, null, 0), summary('B7', 0, null)])).toBe('B7');
  });

  it('falls back to UX-10 when nothing has been answered, and to the first module when all is complete', () => {
    expect(resumeModule([summary('B1', 3, null), summary('B2', 0, null)])).toBe('B2');
    expect(resumeModule([summary('B1', 3, null), summary('B2', 3, null)])).toBe('B1');
    expect(resumeModule([])).toBeUndefined();
  });
});
