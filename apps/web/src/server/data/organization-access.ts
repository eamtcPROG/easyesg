import 'server-only';
import { API_OUTCOME, type ApiOutcome, type ListResult } from '@/lib/api-outcome';
import { TENANT_READ, isPermissionRefusal, type TenantReadRefusal } from './tenant-read';
import {
  ACCESS_ROW_KIND,
  ACCESS_PAGE_SIZE,
  accessListQuery,
  type AccessPage,
  type AccessRow,
  type AccessStanding,
  type AccessView,
} from '@/features/organization/access/tools/access';
import { MEMBERSHIP_ROLE, type MembershipRole, type SeatConsumption } from '@easyesg/contracts';
import { api } from '../api/api-client';

/**
 * S-16's read — the seam that fetches, beside the rule that decides (task 26.4).
 *
 * The same split `server/post-sign-in.ts` makes: this file knows the routes and what their failures
 * mean, and `features/organization/access/tools/access.ts` knows what a list of people *is*.
 *
 * **It fetches one page of one resource now** (task 131). It used to fetch `GET /members` and
 * `GET /invitations` whole and hand both to `applyAccessView`, which filtered, sorted and sliced
 * them in this tier. `GET /access` is the union computed in one statement, so the filter, the order
 * and the window are applied to the merged set — which is the thing two endpoints cannot be made to
 * do, because page 2 of one unioned with page 2 of the other is not page 2 of the union.
 *
 * **This is a Server Component read**, which is why `proxy.ts` has page-load rotation
 * (architecture.md §12.5.6): here a cookie write throws, so the access token must already be fresh.
 */

/**
 * The read's three arms are `TENANT_READ`'s, shared since task 30.3 — S-15 draws the same three
 * and a second `as const` beside this one is the drift the convention exists to prevent.
 */
export { TENANT_READ as ACCESS_READ } from './tenant-read';

export type AccessRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly page: AccessPage;
      /** The ceiling and the seats held against it (task 142) — a fact about the organization. */
      readonly seats: SeatConsumption;
    }
  | TenantReadRefusal;

/** The wire's flat row — a union in both tiers, flat between them (`AccessRowResponseDto`). */
interface AccessRowWire {
  readonly kind: string;
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: MembershipRole;
  readonly standing: AccessStanding;
  readonly accountId: string | null;
  readonly joinedAt: number | null;
  readonly lastActiveAt: number | null;
  readonly issuedAt: number | null;
  readonly expiresAt: number | null;
}

/**
 * The wire row, narrowed back to the union the screen reads.
 *
 * `kind` is the discriminator the API publishes for exactly this, and the nulls it carries are
 * *"this question does not apply"* rather than *"nothing is known"* — which is why they can be
 * asserted away here rather than threaded through every consumer as optional.
 */
const toAccessRow = (row: AccessRowWire): AccessRow =>
  row.kind === ACCESS_ROW_KIND.MEMBER
    ? {
        kind: ACCESS_ROW_KIND.MEMBER,
        id: row.id,
        email: row.email,
        role: row.role,
        standing: row.standing,
        accountId: row.accountId as string,
        // Asserted with `accountId` and for the same reason: the API derives it with `email` as
        // the last fallback, so the member half of the union can never answer null.
        displayName: row.displayName as string,
        lastActiveAt: row.lastActiveAt,
        joinedAt: row.joinedAt as number,
      }
    : {
        kind: ACCESS_ROW_KIND.INVITATION,
        id: row.id,
        email: row.email,
        role: row.role,
        standing: row.standing,
        issuedAt: row.issuedAt as number,
        expiresAt: row.expiresAt as number,
      };

/**
 * One page of the list, and the one count a page cannot answer.
 *
 * **Two calls, in parallel, and the second is not a duplicate of the first.** FR-60's lockout mirror
 * asks *"is this the organization's last administrator"* — a fact about the organization. While the
 * browser tier held every row that was derivable from the page it already had; under server-side
 * paging it is not, and an organization whose only administrator sits on page 2 would be offered a
 * demotion on page 1 that the API then refuses. So the count is asked for directly: the same route,
 * filtered to administrators, one row wide. `total` on that answer *is* the count.
 *
 * **A partial failure is a failure.** If the count answers and the page does not, the honest answer
 * is that the list could not be read — half of "who can see our ESG data" presented as the whole is
 * the one wrong answer this screen must not give. The same is true the other way: without the count
 * the screen would have to guess at FR-60, and guessing wrong offers a control that cannot act.
 */
export const readOrganizationAccess = async (view: AccessView): Promise<AccessRead> => {
  const [listed, administrators, seats] = await Promise.all([
    api.getList<AccessRowWire>('/access', accessListQuery(view)),
    api.getList<AccessRowWire>('/access', {
      filters: [{ field: 'role', values: [MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR] }],
      // One row, because only the count is read. `onpage: 1` rather than 0: the API's floor is 1,
      // and asking for none would be a different request than asking for as few as possible.
      onpage: 1,
    }),
    // Task 142's region. The same all-or-nothing rule as the count above, and for its reason: the
    // seats decide which control the invite panel offers, so a screen missing them would have to
    // guess — and an unreadable *ceiling* is not a failed read: the API answers `allowance: null`,
    // which is the region's own partial state rather than this function's unreachable one.
    api.get<SeatConsumption>('/access/seats'),
  ]);

  if (isPermissionRefusal(listed) || isPermissionRefusal(administrators) || isPermissionRefusal(seats)) {
    return { status: TENANT_READ.FORBIDDEN };
  }
  if (
    listed.status !== API_OUTCOME.Ok ||
    administrators.status !== API_OUTCOME.Ok ||
    seats.status !== API_OUTCOME.Ok
  ) {
    return { status: TENANT_READ.UNREACHABLE };
  }

  return {
    status: TENANT_READ.READY,
    page: toAccessPage({ listed: listed.value, administrators: administrators.value.total, view }),
    seats: seats.value,
  };
};

/**
 * The envelope, as the Index archetype's page.
 *
 * `total` on the wire counts rows surviving the filter — what the pager divides — and `unfiltered`
 * counts rows before it, which is what tells an empty result whether nobody has been invited yet or
 * the filter matched nobody. `IndexShell` reads them under those two names, so the mapping is where
 * one vocabulary meets the other rather than a rename for its own sake.
 *
 * **`unfiltered` falls back to `total`, and the fallback is only reachable if the route stops
 * sending it.** With no filter the two are equal by definition, so the default is the right answer
 * exactly when it is used.
 */
const toAccessPage = (input: {
  readonly listed: ListResult<AccessRowWire>;
  readonly administrators: number;
  readonly view: AccessView;
}): AccessPage => ({
  rows: input.listed.items.map(toAccessRow),
  matched: input.listed.total,
  total: input.listed.unfiltered ?? input.listed.total,
  page: input.view.page,
  pageSize: ACCESS_PAGE_SIZE,
  administrators: input.administrators,
});

/** Re-exported so a caller that only needs the outcome shape does not reach past this module. */
export type { ApiOutcome };
