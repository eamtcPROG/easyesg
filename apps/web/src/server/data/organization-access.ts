import 'server-only';
import type { Invitation, Member } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { TENANT_READ, isPermissionRefusal } from './tenant-read';
import { toAccessRows, type AccessRow } from '@/features/organization/access';
import { api } from '../api-client';

/**
 * S-16's read — the seam that fetches, beside the rule that decides (task 26.4).
 *
 * The same split `server/post-sign-in.ts` makes: this file knows the two routes and what their
 * failures mean, and `features/organization/access.ts` knows what a list of people *is*. Keeping
 * the API client out of that module is what lets the filter, the sort, the page arithmetic and the
 * standing rule be a unit spec rather than four browser journeys.
 *
 * **This is a Server Component read**, which is the whole reason `proxy.ts` gained page-load
 * rotation in this task (architecture.md §12.5.6): here a cookie write throws, so the access token
 * must already be fresh when this runs.
 */

/**
 * The read's three arms are `TENANT_READ`'s, shared since task 30.3 — S-15 draws the same three
 * and a second `as const` beside this one is the drift the convention exists to prevent. The alias
 * keeps this module's own vocabulary readable at its call sites.
 */
export { TENANT_READ as ACCESS_READ } from './tenant-read';

export type AccessRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly rows: readonly AccessRow[];
      /**
       * The instant the rows were read, which is what an invitation's standing is judged against.
       *
       * It belongs here rather than in the render for two reasons, and only one of them is the
       * lint rule that found it. A standing evaluated at render could differ from one evaluated at
       * read for a row sitting on its expiry — filtered as live, labelled as lapsed. And the whole
       * page shares one tick, so no two rows can disagree about what "now" was.
       */
      readonly readAt: number;
    }
  | { readonly status: typeof TENANT_READ.FORBIDDEN }
  | { readonly status: typeof TENANT_READ.UNREACHABLE };


/**
 * Both collections, together.
 *
 * `Promise.all` rather than two awaits (`async-parallel`): they are independent reads and the
 * screen cannot render either half alone — FR-56's list is the union, and showing members while
 * invitations are still in flight would draw a list that is briefly, silently wrong about who has
 * access.
 *
 * **A partial failure is a failure.** If invitations answer and members do not, the honest answer
 * is not "here are your invitations" — it is that the list could not be read. Half of "who can see
 * our ESG data" presented as the whole is the one wrong answer this screen must not give.
 */
export const readOrganizationAccess = async (): Promise<AccessRead> => {
  const [members, invitations] = await Promise.all([
    api.getList<Member>('/members'),
    api.getList<Invitation>('/invitations'),
  ]);

  if (isPermissionRefusal(members) || isPermissionRefusal(invitations)) {
    return { status: TENANT_READ.FORBIDDEN };
  }
  if (members.status !== API_OUTCOME.Ok || invitations.status !== API_OUTCOME.Ok) {
    return { status: TENANT_READ.UNREACHABLE };
  }

  return {
    status: TENANT_READ.READY,
    rows: toAccessRows({ members: members.value.items, invitations: invitations.value.items }),
    readAt: Date.now(),
  };
};
