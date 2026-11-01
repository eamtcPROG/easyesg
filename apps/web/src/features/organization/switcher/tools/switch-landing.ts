import { isAccountScreen, routeSegments } from '@/lib/route-access';
import { ROUTES, type RoutePath } from '@/lib/routes';

/** How a probe is read: the api answers one object or a list, and the client reads each differently. */
export const PROBE_SHAPE = { OBJECT: 'object', LIST: 'list' } as const;

export type ProbeShape = (typeof PROBE_SHAPE)[keyof typeof PROBE_SHAPE];

export interface SwitchLanding {
  /** Where the reader lands in the organization just chosen, if its role opens it. */
  readonly href: RoutePath;
  /**
   * The read that screen makes, asked of the api after the switch, or `null` where nothing needs asking.
   * A permission refusal sends the reader home instead — so the role check is the api's, never a table here.
   */
  readonly probe: { readonly path: string; readonly shape: ProbeShape } | null;
}

/**
 * The path segments this rule tells apart, spelled once — internal to this file, per the root file's clause
 * that a vocabulary one file uses is declared in that file. They are segments of incoming addresses rather
 * than addresses the app links to, which is `route-access.ts`'s reason for not deriving its own from `ROUTES`.
 *
 * **The account's screens are not among them, and neither is the reading of an address.** Both are
 * `route-access.ts`'s — `isAccountScreen` and `routeSegments` — because S-37's gate asks the same two
 * questions, and a copy here was free to disagree with it about which screens belong to no organization.
 */
const SEGMENT = {
  REPORTS: 'reports',
  ENTITIES: 'entities',
  ORGANIZATION: 'organization',
  USERS: 'users',
} as const;

const HOME: SwitchLanding = { href: ROUTES.HOME, probe: null };

/**
 * UX-3's equivalent screen (task 83.2; `design_spec.md` UX-3's amendment, project owner, 15 Sep 2026).
 *
 * - **The account's own screens stay.** They are the same in every organization, so the address is kept.
 * - **A section's own screen is its own equivalent**, and a record's screen or a creation form becomes its
 *   section's screen, because the record belongs to the organization just left. Each carries the read its
 *   screen makes as its probe, so whether the new role opens it is the api's answer after the switch.
 * - **Anything else is home.**
 *
 * `from` is the address the reader switched on, in any locale form. Its query is not carried: a filter over
 * one organization's reports says nothing about another's (`architecture.md` §12.5.6's task-83 row).
 */
export const switchLanding = (from: string): SwitchLanding => {
  const segments = routeSegments(from);
  if (isAccountScreen(from)) return { href: `/${segments.join('/')}`, probe: null };

  const [section, sub] = segments;
  switch (section) {
    case SEGMENT.REPORTS:
      return { href: ROUTES.REPORTS, probe: { path: '/reports', shape: PROBE_SHAPE.LIST } };
    case SEGMENT.ENTITIES:
      return { href: ROUTES.ENTITIES, probe: { path: '/entities', shape: PROBE_SHAPE.LIST } };
    case SEGMENT.ORGANIZATION:
      if (sub === SEGMENT.USERS) {
        return { href: ROUTES.ORGANIZATION_USERS, probe: { path: '/access/seats', shape: PROBE_SHAPE.OBJECT } };
      }
      return sub === undefined
        ? { href: ROUTES.ORGANIZATION, probe: { path: '/organization', shape: PROBE_SHAPE.OBJECT } }
        : HOME;
    default:
      return HOME;
  }
};
