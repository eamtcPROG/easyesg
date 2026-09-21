import 'server-only';
import { PROBLEM_TYPE } from '@easyesg/contracts';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';

/**
 * What a tenant-scoped Server Component read can answer — the three arms every such screen draws
 * (extracted 29 Aug 2026, task 30.3).
 *
 * **It was `ACCESS_READ` in `organization-access.ts` and S-15 needed the same three**, which is
 * what a closed vocabulary declared twice looks like the moment before it drifts. The reasoning
 * below is task 26.4's, unchanged; only its home moved.
 *
 * The arms are not interchangeable and collapsing any two loses a screen state §8.1 requires:
 * *forbidden* is UX-1's boundary, which must name who can grant access, and *unreachable* is a
 * three-part "try again" the bundled catalogue owns because the API could not supply one.
 */
export const TENANT_READ = {
  READY: 'ready',
  /**
   * Signed in, and this screen is not theirs. **The API is the authority and the screen never
   * computes the caller's role**: the controllers carry `@RequiresRole` at class level, so the
   * screen asks and renders its permission state on a refusal. One fewer round trip than reading
   * `/memberships` first, and one fewer place for this tier's belief about a role to disagree with
   * the server's.
   */
  FORBIDDEN: 'forbidden',
  /** No answer, or one this tier could not read. Same fact and same remedy as the API being down. */
  UNREACHABLE: 'unreachable',
} as const;

export type TenantReadStatus = (typeof TENANT_READ)[keyof typeof TENANT_READ];

/**
 * The two refusals that mean *this screen is not yours*.
 *
 * Both, and not only `insufficient-role`: a caller holding several memberships with no stated
 * preference resolves no organization at all, so a route behind `@RequiresRole` answers
 * `membership-required` rather than a role refusal. To the reader they are one fact — they cannot
 * see this screen — with one remedy, and task 83's switcher is what resolves the second.
 */
const PERMISSION_PROBLEMS: readonly string[] = [
  PROBLEM_TYPE.InsufficientRole,
  PROBLEM_TYPE.MembershipRequired,
];

export const isPermissionRefusal = (outcome: ApiOutcome<unknown>): boolean =>
  outcome.status === API_OUTCOME.Problem && PERMISSION_PROBLEMS.includes(outcome.problem.type);

/**
 * The arms every tenant read shares beside its own ready one — declared once, because the pair of them was
 * written out at each of eleven reads (task 160).
 *
 * **There is no *signed out* arm, and that is task 161's point.** A session the api has ended never reaches
 * a screen as an answer: the api client sends the reader to sign in from inside the read
 * (`server/api/api-client.ts`), so no read here, and no screen drawing one, has anything to check.
 */
export type TenantReadRefusal =
  | { readonly status: typeof TENANT_READ.FORBIDDEN }
  | { readonly status: typeof TENANT_READ.UNREACHABLE };
