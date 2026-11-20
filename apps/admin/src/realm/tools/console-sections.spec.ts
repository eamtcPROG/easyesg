import { describe, expect, it } from 'vitest';
import { ADMIN_PERMISSION, ADMIN_ROLE } from '@easyesg/contracts';

const EVERY_PERMISSION = Object.values(ADMIN_PERMISSION);
import { Bell, Building2, KeyRound, Landmark, Languages, Layers, LifeBuoy, SlidersHorizontal, UserCog } from 'lucide-react';
import { CONSOLE_DESTINATIONS, consoleSectionsFor, type ConsoleDestinations } from './console-sections';

/**
 * The console nav's two rules (task 67.1): an operator sees their own realm's section, and a section
 * is drawn only when it has a destination that renders.
 *
 * **The billing label is cast**, because a destination's label is typed as a catalogue key and no
 * billing destination has one yet — the guarantee `console-sections.ts` states. The platform label
 * needs no cast since task 67.3 gave `organizations` its words. Section keys are asserted as literals: they
 * are the catalogue's `sections.*` keys, and a renamed value must fail here.
 */
const DESTINATIONS: ConsoleDestinations = {
  platform: [{ href: '/organizations', label: 'destinations.organizations', icon: Building2 }],
  billing: [{ href: '/billing/reconciliation', label: 'destinations.reconciliation' as never, icon: Landmark }],
};

describe('consoleSectionsFor (§5.2)', () => {
  it('shows a Platform Administrator the platform section, and only that', () => {
    expect(
      consoleSectionsFor({ role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR, permissions: EVERY_PERMISSION, destinations: DESTINATIONS }),
    ).toEqual([{ key: 'platform', items: DESTINATIONS.platform }]);
  });

  it('shows a Billing Operator the billing section, and only that', () => {
    expect(
      consoleSectionsFor({ role: ADMIN_ROLE.BILLING_OPERATOR, permissions: [], destinations: DESTINATIONS }),
    ).toEqual([{ key: 'billing', items: DESTINATIONS.billing }]);
  });

  it('draws no section for a realm with no destination, even when the other realm has one', () => {
    expect(
      consoleSectionsFor({
        role: ADMIN_ROLE.BILLING_OPERATOR,
        permissions: [],
        destinations: { platform: DESTINATIONS.platform, billing: [] },
      }),
    ).toEqual([]);
  });

  /**
   * **The chrome carries what renders, pinned as of today.** A-02 is the first console screen to
   * ship (task 67.3), so a Platform Administrator has one destination and a Billing Operator still
   * none — the section a BO would see is empty, and an empty section is not drawn. The next screen to
   * ship changes this assertion deliberately, with its own destination.
   */
  it('shows a Platform Administrator every platform screen that renders, and a Billing Operator nothing, as shipped', () => {
    expect(
      consoleSectionsFor({
        role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
        permissions: EVERY_PERMISSION,
        destinations: CONSOLE_DESTINATIONS,
      }),
    ).toEqual([
      {
        key: 'platform',
        items: [
          {
            href: '/organizations',
            label: 'destinations.organizations',
            icon: Building2,
            permission: 'organizations.read',
          },
          { href: '/content', label: 'destinations.content', icon: Languages, permission: 'content.edit' },
          { href: '/taxonomy', label: 'destinations.taxonomy', icon: Layers, permission: 'taxonomy.manage' },
          { href: '/rules', label: 'destinations.rules', icon: SlidersHorizontal, permission: 'rules.manage' },
          { href: '/accounts', label: 'destinations.accounts', icon: UserCog, permission: 'accounts.read' },
          {
            href: '/support-access',
            label: 'destinations.supportAccess',
            icon: LifeBuoy,
            permission: 'support_access.read',
          },
          {
            href: '/identity-providers',
            label: 'destinations.identityProviders',
            icon: KeyRound,
            permission: 'identity_providers.manage',
          },
          {
            href: '/notification-templates',
            label: 'destinations.notificationCategories',
            icon: Bell,
            permission: 'notification_categories.manage',
          },
          {
            href: '/legal-controller',
            label: 'destinations.legalController',
            icon: Landmark,
            permission: 'legal_controller.manage',
          },
        ],
      },
    ]);
    expect(
      consoleSectionsFor({ role: ADMIN_ROLE.BILLING_OPERATOR, permissions: [], destinations: CONSOLE_DESTINATIONS }),
    ).toEqual([]);
  });

  it('leaves out a destination the operator’s roles do not open, and the section when none is left (task 67.13)', () => {
    const contentOnly = consoleSectionsFor({
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
      permissions: [ADMIN_PERMISSION.CONTENT_EDIT],
      destinations: CONSOLE_DESTINATIONS,
    });
    expect(contentOnly.flatMap((section) => section.items.map((item) => item.href))).toEqual(['/content']);

    const support = consoleSectionsFor({
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
      permissions: [ADMIN_PERMISSION.ORGANIZATIONS_READ, ADMIN_PERMISSION.SUPPORT_ACCESS_READ],
      destinations: CONSOLE_DESTINATIONS,
    });
    expect(support.flatMap((section) => section.items.map((item) => item.href))).toEqual([
      '/organizations',
      '/support-access',
    ]);
  });
});
