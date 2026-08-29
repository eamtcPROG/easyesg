'use server';

import type {
  ChangeMemberRoleRequest,
  CreateOrganizationRequest,
  Invitation,
  IssueInvitationRequest,
  Member,
  Organization,
  UpdateOrganizationRequest,
} from '@easyesg/contracts';
import { revalidatePath } from 'next/cache';
import { mapOutcome, type ApiOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api-client';
import type { AccessActionResult } from './types/action-results';

/**
 * S-16's five writes (UC-60 … UC-64), as Server Actions.
 *
 * Same transport decision as task 20's identity actions and for the same reason: the browser posts
 * to the Next server tier, which calls the public API as the ordinary client AD-9 says it is. The
 * `/api/[...path]` pass-through stays scoped to traffic that cannot come through here — the
 * wizard's PATCH stream, the offline drain, the polls.
 *
 * An action is a projection and nothing more. Every rule stays on the API: FR-60's lockout, both
 * invitation collisions, the seat entitlement when task 54.2 gives it an implementation. The screen
 * mirrors the lockout rule only to avoid *offering* an action that will be refused
 * (`isLastAdministrator`), and the refusal remains authoritative — between a render and a click,
 * someone else may have been demoted.
 *
 * **Every write revalidates the screen's own path.** These actions change the list they were
 * invoked from, and `(app)` is `force-dynamic`, so the revalidation is not about a cache of the
 * data — it is what makes the Server Component re-run and the table redraw without the caller
 * assembling an optimistic update it would then have to reconcile.
 */
const ACCESS_PATH = '/[locale]/(app)/(workspace)/organization/users';

/** The authenticated shell, whose global tier names the active organization on every screen
 *  below it (task 30.1). Revalidated as a `layout` rather than a `page`, so every segment under
 *  it is refetched rather than only the one the caller happens to be on. */
const APP_LAYOUT_PATH = '/[locale]/(app)';

const revalidateAccess = (): void => {
  revalidatePath(ACCESS_PATH, 'page');
};

/** UC-62 and UC-64 — change a role, or promote to Organization Administrator. One route: the
 *  promotion is a role change whose target happens to be the widest role, and modelling it as its
 *  own verb would give FR-60's lockout two places to be enforced. */
export async function changeMemberRoleAction(input: {
  readonly membershipId: string;
  readonly role: ChangeMemberRoleRequest['role'];
}): Promise<AccessActionResult> {
  const outcome = await api.patch<ChangeMemberRoleRequest, Member>(
    `/members/${input.membershipId}`,
    { role: input.role },
  );
  revalidateAccess();
  return mapOutcome(outcome, () => null);
}

/** UC-63 — remove a member's access. FR-59: the account and their attributed history survive; the
 *  membership stops granting. The dialogue says so before this is called (UX-69). */
export async function removeMemberAction(input: {
  readonly membershipId: string;
}): Promise<AccessActionResult> {
  const outcome = await api.delete(`/members/${input.membershipId}`);
  revalidateAccess();
  return mapOutcome(outcome, () => null);
}

/** UC-60 — invite by email at an edit or view-only role. Both collisions are refused by the API
 *  with the resolving action named, and the screen renders that text as received (NFR-79). */
export async function inviteMemberAction(
  input: IssueInvitationRequest,
): Promise<AccessActionResult> {
  const outcome = await api.post<IssueInvitationRequest, Invitation>('/invitations', input);
  revalidateAccess();
  return mapOutcome(outcome, () => null);
}

/** UC-61's resend — rotates the token and restarts the seven days on the same row, so the list
 *  keeps one line per invited person and the outstanding link becomes the new one (§12.5.6). */
export async function resendInvitationAction(input: {
  readonly invitationId: string;
}): Promise<AccessActionResult> {
  const outcome = await api.post<undefined, undefined>(
    `/invitations/${input.invitationId}/email`,
    undefined,
  );
  revalidateAccess();
  return mapOutcome(outcome, () => null);
}

/** UC-61's revoke — FR-57's "invalidates the outstanding link immediately", from the
 *  administrator's side. */
export async function revokeInvitationAction(input: {
  readonly invitationId: string;
}): Promise<AccessActionResult> {
  const outcome = await api.delete(`/invitations/${input.invitationId}`);
  revalidateAccess();
  return mapOutcome(outcome, () => null);
}

/**
 * UC-49 — create an organization and become its Organization Administrator (FR-13, D-1).
 *
 * **It revalidates the `(app)` LAYOUT, not a page, and that is the whole difference from the four
 * above.** They change a list the caller is looking at; this one creates the tenant the entire
 * session is about to be scoped to — the API grants the founding membership and points
 * `identity.session.active_organization_id` at it in the same transaction (task 29.1). So what
 * goes stale is the global tier, which reads the caller's memberships in the layout above **every**
 * authenticated screen.
 *
 * Measured rather than reasoned about: without this the browser journey founds an organization,
 * lands on `/home`, and the band above it is still empty. `(app)` is `force-dynamic`, so there is
 * no server cache to blame — it is the **client** router cache, which holds the RSC payload of a
 * layout it has already visited and has no way to know that a POST changed what that layout reads.
 *
 * The organization comes back rather than `null`, unlike `AccessActionResult`: S-04's exit states
 * the name it just created, and re-reading it would be a second round trip for a value the write
 * already answered.
 */
export async function createOrganizationAction(
  input: CreateOrganizationRequest,
): Promise<ApiOutcome<Organization>> {
  const outcome = await api.post<CreateOrganizationRequest, Organization>('/organizations', input);
  revalidatePath(APP_LAYOUT_PATH, 'layout');
  return mapOutcome(outcome, (organization) => organization);
}

/**
 * UC-50 — edit the organization profile (FR-15, FR-16).
 *
 * **It revalidates the `(app)` layout, like the founding action and for a subset of its reason.**
 * The global tier names the active organization on every authenticated screen, so a change to
 * `name` goes stale everywhere at once rather than on this page. Revalidating the page as well
 * would be redundant — a layout revalidation refetches every segment beneath it.
 *
 * **The organization comes back and the screen re-seeds its form from it**, which is what makes
 * the save/discard pair honest: the API normalises (a trimmed name, an upper-cased country and
 * LEI), so a form left holding what the reader typed would show a dirty field they cannot clean.
 */
export async function updateOrganizationProfileAction(
  patch: UpdateOrganizationRequest,
): Promise<ApiOutcome<Organization>> {
  const outcome = await api.patch<UpdateOrganizationRequest, Organization>('/organization', patch);
  revalidatePath(APP_LAYOUT_PATH, 'layout');
  return mapOutcome(outcome, (organization) => organization);
}
