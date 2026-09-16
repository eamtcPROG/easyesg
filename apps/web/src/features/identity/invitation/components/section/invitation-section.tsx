import { getTranslations } from 'next-intl/server';
import { API_OUTCOME } from '@/lib/api-outcome';
import { ROUTES } from '@/lib/routes';
import { destinationForHeldSession } from '@/server/session/post-sign-in';
import { readSession } from '@/server/session/session';
import styles from '../../../shared/styles/identity-screens.module.css';
import { previewInvitationAction } from '../../actions/actions';
import { INVITATION_VIEW, invitationRemedy, invitationView } from '../../tools/invitation';
import { AcceptInvitation } from '../parts/accept-invitation';
import { InvitationSummary } from '../parts/invitation-summary';
import { INVITATION_MESSAGES } from '../shared/invitation-messages';
import { SignedOut } from '../states/signed-out';
import { Unreachable } from '../states/unreachable';
import { Unusable } from '../states/unusable';
import { WrongAccount } from '../states/wrong-account';

/**
 * S-03's one region: the two reads, the branch, and the five surfaces one per arm (UC-15).
 *
 * **The section reads; the parts render** (task 134, from S-05's rule). The route was 233 lines
 * holding this read and five components; it now pins the locale and renders this. The two reads are
 * independent — the session comes from a cookie this tier already holds, the preview is an API round
 * trip — so they run together (`async-parallel`). **Nothing is consumed on render**: the preview
 * reads the invitation without spending it, and acceptance is an explicit POST from
 * `AcceptInvitation` — the property task 19 built the verification flow around, and the reason a
 * mail scanner following the link cannot burn it.
 *
 * The branch itself is `tools/invitation.ts`, deliberately: it reaches no API, so its five arms —
 * three of them error states — are a unit spec rather than five browser journeys. Every state below
 * takes what was read — the whole invitation, never a projection of it.
 *
 * **A third read, only for the unusable arm and only for a session** (task 114): where that session
 * belongs, so a signed-in reader holding a spent link is offered their home page rather than told to
 * sign in. It follows the preview because the arm is not known until the preview answers, and it is
 * the rare arm (`async-defer-await`); the accept arm resolves its own remedy only when an acceptance
 * is refused, in the action.
 */
export async function InvitationSection({ token }: { readonly token: string }) {
  const [preview, session, t] = await Promise.all([
    previewInvitationAction({ token }),
    readSession(),
    getTranslations(INVITATION_MESSAGES),
  ]);

  const view = invitationView({
    preview: preview.status === API_OUTCOME.Ok ? preview.value : null,
    signedInAs: session?.account.email ?? null,
  });

  const unusable =
    view.kind === INVITATION_VIEW.UNUSABLE
      ? {
          standing: view.standing,
          remedy: invitationRemedy({
            destination: session === null ? null : await destinationForHeldSession(),
            signIn: ROUTES.SIGN_IN,
          }),
        }
      : null;

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      {view.kind === INVITATION_VIEW.ACCEPT ? (
        <div className={styles.stack}>
          <InvitationSummary invitation={view.invitation} />
          <AcceptInvitation token={token} invitation={view.invitation} />
        </div>
      ) : view.kind === INVITATION_VIEW.SIGN_IN_REQUIRED ? (
        <SignedOut token={token} invitation={view.invitation} />
      ) : view.kind === INVITATION_VIEW.WRONG_ACCOUNT ? (
        <WrongAccount token={token} invitation={view.invitation} signedInAs={view.signedInAs} />
      ) : unusable !== null ? (
        <Unusable standing={unusable.standing} remedy={unusable.remedy} />
      ) : (
        <Unreachable />
      )}
    </>
  );
}
