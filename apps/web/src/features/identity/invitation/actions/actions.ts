'use server';

import type { AcceptedInvitation, InvitationPreview, InvitationTokenRequest } from '@easyesg/contracts';
import { getLocale } from 'next-intl/server';
import { API_OUTCOME } from '@/lib/api-outcome';
import { withQuery } from '@/lib/routes';
import { endsSession } from '@/lib/session-standing';
import { redirect } from '@/i18n/navigation';
import { api } from '@/server/api/api-client';
import { destinationForHeldSession } from '@/server/session/post-sign-in';
import { POST_SIGN_IN } from '../../shared/tools/post-sign-in';
import { invitationHandOff, invitationRemedy } from '../tools/invitation';
import type { AcceptInvitationFailure, InvitationPreviewResult } from './action-results';

/** S-03's two calls (UC-15, FR-11). The transport rule is stated once, in `shared/actions/actions.ts`. */
/**
 * S-03's opening read (UC-15) — what the invitation offers, before anything is used.
 *
 * **The token goes in a POST body, not a URL**, which is the API's shape for all three token kinds
 * and the reason a mail scanner prefetching the link cannot burn it: nothing is consumed on render,
 * here or on the server.
 *
 * An unusable link comes back as `Ok` carrying a `standing`, not as a problem — S-03 draws expired,
 * already-used, revoked and not-found as four distinguishable recoverable states, so the screen has
 * to branch on a value rather than on prose. Only transport failures reach the `Problem` and
 * `Unreachable` arms.
 */
export async function previewInvitationAction(
  input: InvitationTokenRequest,
): Promise<InvitationPreviewResult> {
  // Returned as it arrives: `InvitationPreviewResult` IS `ApiOutcome<InvitationPreview>`, so
  // there is nothing to project. This read `mapOutcome(outcome, (preview) => preview)`, which is
  // the identity function wearing the projection helper's clothes — it reads as though a mapping
  // happens and costs a reader the moment it takes to confirm none does.
  return api.post<InvitationTokenRequest, InvitationPreview>('/invitations/preview', input);
}

/**
 * UC-15's acceptance (FR-11), and the exit S-03 promises: **S-05 in the newly joined
 * organization**.
 *
 * No `?return=` and no branch: unlike sign-in, this call has already decided where the user
 * belongs, and the API pointed the session at that organization inside the same transaction
 * (`architecture.md` §12.5.6's task-26.2 row). So the redirect is unconditional, and `/home`
 * resolves to the organization just joined without this tier knowing which it was.
 *
 * `postSignInTarget` is deliberately NOT consulted **on success**. Its job is to choose among none /
 * one / several, and none of those questions is open here — the answer is the organization on the
 * invitation, chosen by the person who clicked.
 *
 * **A refusal is where it is consulted** (task 114): the callout's way out must fit the reader. At
 * 401 the session has ended, so it is sign-in and back to this invitation, which was usable when the
 * screen rendered; any other refusal leaves the session as it was, so it is §4.3's branch for that
 * session, read now rather than at render so it describes the state after the attempt. The held
 * session's reading is the right one because a refusal establishes nothing.
 */
export async function acceptInvitationAction(
  input: InvitationTokenRequest,
): Promise<AcceptInvitationFailure> {
  const outcome = await api.post<InvitationTokenRequest, AcceptedInvitation>(
    '/invitations/acceptance',
    input,
  );
  if (outcome.status === API_OUTCOME.Unreachable) return outcome;
  if (outcome.status === API_OUTCOME.Problem) {
    const sessionEnded = endsSession(outcome.problem.status);
    return {
      ...outcome,
      remedy: invitationRemedy({
        destination: sessionEnded ? null : await destinationForHeldSession(),
        signIn: invitationHandOff(input.token).signIn,
      }),
    };
  }

  // **The grant travels to S-05 in the address** (task 30.5, closing a review note of 26 Aug 2026).
  // Without it the three grants are indistinguishable and somebody who *already had access* sees
  // exactly the landing a new member sees — having clicked a link that told them nothing. Its own
  // parameter rather than task 24's `?notice=`: two vocabularies on two screens, and one name over
  // both is how a value from one starts rendering on the other.
  redirect({
    href: withQuery(POST_SIGN_IN.HOME, `joined=${outcome.value.grant}`),
    locale: await getLocale(),
  });
}
