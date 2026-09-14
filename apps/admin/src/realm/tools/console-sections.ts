import { ADMIN_ROLE, type AdminRole } from '@easyesg/contracts';
import type ro from '~/messages/ro.json';

/**
 * Which navigation an operator sees (`design_spec.md` §5.2; project owner, 13 Sep 2026; task 67.1).
 *
 * **Their own realm's section, and only destinations whose screen renders.** actors.md gives PA no
 * billing authority and BO no platform authority, so the other section would be a list of refusals —
 * which makes this presentation and never a boundary: `AdminRealmGuard` (task 67.3) is what refuses.
 * And `GlobalTier`'s rule holds for this chrome too: a destination enters the navigation with its
 * screen, so both lists are empty until A-02 ships, and a section with nothing in it is not drawn.
 *
 * **A destination can only be declared with a label.** Its `label` is a message key under the
 * catalogue's `realm.chrome.destinations`, which is empty today, so an entry added before its label
 * exists is a type error rather than a blank link. **The full path, not the leaf**, so the chrome
 * resolves it with a plain `t(label)`: a template literal over a key set with no members is `never`,
 * and the first cut, which built one, was refused by both `tsc` and `restrict-template-expressions`.
 */
export const CONSOLE_SECTION = {
  PLATFORM: 'platform',
  BILLING: 'billing',
} as const;

export type ConsoleSection = (typeof CONSOLE_SECTION)[keyof typeof CONSOLE_SECTION];

type DestinationLabel = `destinations.${Extract<keyof (typeof ro)['realm']['chrome']['destinations'], string>}`;

export interface ConsoleDestination {
  /** The route, which is also the item's stable key. */
  readonly href: string;
  /** A key under `realm.chrome`, resolved by the chrome. */
  readonly label: DestinationLabel;
}

export type ConsoleDestinations = Readonly<Record<ConsoleSection, readonly ConsoleDestination[]>>;

/** The realm each privilege level works in (actors.md). */
export const SECTION_OF_ROLE = {
  [ADMIN_ROLE.PLATFORM_ADMINISTRATOR]: CONSOLE_SECTION.PLATFORM,
  [ADMIN_ROLE.BILLING_OPERATOR]: CONSOLE_SECTION.BILLING,
} as const satisfies Record<AdminRole, ConsoleSection>;

/**
 * Every destination with a screen that renders — A-02's register (67.3), A-08's accounts (67.4), A-07's support
 * access (67.9), A-18's identity providers (67.11).
 */
export const CONSOLE_DESTINATIONS: ConsoleDestinations = {
  [CONSOLE_SECTION.PLATFORM]: [
    { href: '/organizations', label: 'destinations.organizations' },
    // A-08, since task 67.4.
    { href: '/accounts', label: 'destinations.accounts' },
    // A-07, since task 67.9.
    { href: '/support-access', label: 'destinations.supportAccess' },
    // A-18, since task 67.11.
    { href: '/identity-providers', label: 'destinations.identityProviders' },
  ],
  [CONSOLE_SECTION.BILLING]: [],
};

export interface ConsoleSectionData {
  readonly key: ConsoleSection;
  readonly items: readonly ConsoleDestination[];
}

/**
 * The sections to draw for one operator: their realm's, if it has a destination, and nothing else.
 * Takes the destinations rather than reading the module's own, so the rule is testable before any
 * destination exists.
 */
export const consoleSectionsFor = ({
  role,
  destinations,
}: {
  readonly role: AdminRole;
  readonly destinations: ConsoleDestinations;
}): readonly ConsoleSectionData[] => {
  const section = SECTION_OF_ROLE[role];
  const items = destinations[section];
  return items.length === 0 ? [] : [{ key: section, items }];
};
