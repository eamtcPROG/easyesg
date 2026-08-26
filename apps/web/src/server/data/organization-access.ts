import 'server-only';
import { PROBLEM_TYPE, type Invitation, type Member } from '@easyesg/contracts';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
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

export const ACCESS_READ = {
  READY: 'ready',
  /**
   * Signed in, and this screen is not theirs. The API is the authority — both controllers carry
   * `@RequiresRole(ORGANIZATION_ADMINISTRATOR)` at class level — so the screen never computes the
   * caller's role to decide what to draw. It asks, and renders S-16's permission state on a
   * refusal. That is one fewer round trip than reading `/memberships` first, and one fewer place
   * for the web tier's belief about a role to disagree with the server's.
   */
  FORBIDDEN: 'forbidden',
  /** No answer, or one this tier could not read. Same fact and same remedy as the API being down. */
  UNREACHABLE: 'unreachable',
} as const;

export type AccessReadStatus = (typeof ACCESS_READ)[keyof typeof ACCESS_READ];

export type AccessRead =
  | {
      readonly status: typeof ACCESS_READ.READY;
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
  | { readonly status: typeof ACCESS_READ.FORBIDDEN }
  | { readonly status: typeof ACCESS_READ.UNREACHABLE };

const PERMISSION_PROBLEMS: readonly string[] = [
  PROBLEM_TYPE.InsufficientRole,
  PROBLEM_TYPE.MembershipRequired,
];

const isPermissionRefusal = (outcome: ApiOutcome<unknown>): boolean =>
  outcome.status === API_OUTCOME.Problem && PERMISSION_PROBLEMS.includes(outcome.problem.type);

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
    return { status: ACCESS_READ.FORBIDDEN };
  }
  if (members.status !== API_OUTCOME.Ok || invitations.status !== API_OUTCOME.Ok) {
    return { status: ACCESS_READ.UNREACHABLE };
  }

  return {
    status: ACCESS_READ.READY,
    rows: toAccessRows({ members: members.value.items, invitations: invitations.value.items }),
    readAt: Date.now(),
  };
};
