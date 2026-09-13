import { describe, expect, it } from 'vitest';
import { ADMIN_ROLE } from '@easyesg/contracts';
import { CONSOLE_DESTINATIONS, consoleSectionsFor, type ConsoleDestinations } from './console-sections';

/**
 * The console nav's two rules (task 67.1): an operator sees their own realm's section, and a section
 * is drawn only when it has a destination that renders.
 *
 * **The labels are cast**, because a destination's label is typed as a catalogue key that does not
 * exist yet — the guarantee `console-sections.ts` states. Section keys are asserted as literals: they
 * are the catalogue's `sections.*` keys, and a renamed value must fail here.
 */
const DESTINATIONS: ConsoleDestinations = {
  platform: [{ href: '/organizations', label: 'destinations.organizations' as never }],
  billing: [{ href: '/billing/reconciliation', label: 'destinations.reconciliation' as never }],
};

describe('consoleSectionsFor (§5.2)', () => {
  it('shows a Platform Administrator the platform section, and only that', () => {
    expect(
      consoleSectionsFor({ role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR, destinations: DESTINATIONS }),
    ).toEqual([{ key: 'platform', items: DESTINATIONS.platform }]);
  });

  it('shows a Billing Operator the billing section, and only that', () => {
    expect(
      consoleSectionsFor({ role: ADMIN_ROLE.BILLING_OPERATOR, destinations: DESTINATIONS }),
    ).toEqual([{ key: 'billing', items: DESTINATIONS.billing }]);
  });

  it('draws no section for a realm with no destination, even when the other realm has one', () => {
    expect(
      consoleSectionsFor({
        role: ADMIN_ROLE.BILLING_OPERATOR,
        destinations: { platform: DESTINATIONS.platform, billing: [] },
      }),
    ).toEqual([]);
  });

  /**
   * **The chrome carries what renders, pinned as of today.** No console screen behind the realm has
   * shipped, so no operator has a destination. Task 67.3 changes this assertion when A-02 lands —
   * deliberately, rather than a destination entering the navigation ahead of its screen.
   */
  it('draws nothing for anyone until the first console screen ships', () => {
    for (const role of Object.values(ADMIN_ROLE)) {
      expect(consoleSectionsFor({ role, destinations: CONSOLE_DESTINATIONS })).toEqual([]);
    }
  });
});
