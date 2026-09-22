'use server';

import type {
  ChangeMemberRoleRequest,
  Invitation,
  IssueInvitationRequest,
  Member,
  SendReportReminderRequest,
} from '@easyesg/contracts';
import { revalidatePath } from 'next/cache';
import { mapOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';
import type { AccessActionResult } from './action-results';

/**
 * S-16's five writes (UC-60 … UC-64), as Server Actions.
 *
 * **In `actions/`, which is the decision task 126 deferred** (task 127). That task put S-05 under
 * *a directory holds files or folders, never both* and left these three screens alone with a stated
 * reason: this module carries `'use server'`, so where it lands is a decision about a
 * **directive-bearing** module rather than a move. The decision is that the directive is what makes
 * it a third kind. A screen folder holds up to three: `components/` renders, `tools/` is pure, and
 * `actions/` is the half that may export only async functions and whose exports the bundler turns
 * into callable endpoints. Folding it into `tools/` would put a module with a hard export
 * constraint — and a public surface — among modules with neither, and `lib/revalidate-paths.ts`
 * exists precisely because that constraint bites at the *build*, which `typecheck`, `lint` and 286
 * unit tests all missed once already.
 *
 * **`actions/actions.ts` stutters and stays**, on the rule task 123 recorded for
 * `access/access-list.tsx`: this app leans on file names that survive out of context, and a path is
 * what disambiguates `actions.ts` in a stack trace either way — seven features already have one.
 *
 * `action-results.ts` is here rather than in `tools/` because it is these actions' return type and
 * nothing else's, which is what its own docblock has said since task 123.
 *
 * Same transport decision as task 20's identity actions and for the same reason: the browser posts
 * to the Next server tier, which calls the public API as the ordinary client AD-9 says it is. The
 * `/api/[...path]` pass-through stays scoped to traffic that cannot come through here — the
 * wizard's PATCH stream, the offline drain, the polls.
 *
 * An action is a projection and nothing more. Every rule stays on the API: FR-60's lockout, both
 * invitation collisions, the seat ceiling (task 142). The screen mirrors the lockout and the ceiling
 * only to avoid *offering* an action that will be refused (`isLastAdministrator`, `seatRegion`), and
 * the refusal remains authoritative — between a render and a click, someone else may have been
 * demoted, or invited.
 *
 * **Every write revalidates the screen's own path.** These actions change the list they were
 * invoked from, and `(app)` is `force-dynamic`, so the revalidation is not about a cache of the
 * data — it is what makes the Server Component re-run and the table redraw without the caller
 * assembling an optimistic update it would then have to reconcile.
 */
const ACCESS_PATH = '/[locale]/(app)/(workspace)/organization/users';

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
 * UC-175's manual reminder (task 50.3) — raised about one open report, to one member, with an optional note.
 * **Nothing on S-16 changes**, so nothing is revalidated: the reminder is a notice in someone else's centre.
 */
export async function sendReminderAction(input: {
  readonly reportId: string;
  readonly membershipId: string;
  readonly note?: string;
}): Promise<AccessActionResult> {
  const outcome = await api.post<SendReportReminderRequest, undefined>(`/reports/${input.reportId}/reminders`, {
    membershipId: input.membershipId,
    note: input.note,
  });
  return mapOutcome(outcome, () => null);
}
