import { getTranslations } from 'next-intl/server';
import { Button, Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { signOutAction } from '../../../shared/actions/actions';
import styles from '../../../shared/styles/identity-screens.module.css';
import { invitationHandOff, type UsableInvitation } from '../../tools/invitation';
import { INVITATION_MESSAGES } from '../shared/invitation-messages';

/**
 * S-03's permission state (amended 25 Aug 2026) — a forwarded link, or the second mailbox a
 * bookkeeper actually uses.
 *
 * It names **both** addresses, because "this invitation is not for you" is unactionable without
 * saying which of the reader's mailboxes it is for. The primary way out signs out and returns
 * here, so the link survives the round trip; the second is stated as prose, since asking an
 * administrator for a different invitation is not something this screen can do.
 */
export async function WrongAccount({
  token,
  invitation,
  signedInAs,
}: {
  readonly token: string;
  /** The whole invitation, not its address: the state names both mailboxes and may need more. */
  readonly invitation: UsableInvitation;
  readonly signedInAs: string;
}) {
  const t = await getTranslations(INVITATION_MESSAGES);
  const links = invitationHandOff(token);

  return (
    <div className={styles.stack}>
      {/* `Callout.action` is required by design — NFR-79's "what now" — and here the action IS the
          way out rather than a link beside it, so the control lives in that slot. The sign-out
          action redirects to `/sign-in` on its own; the bound return path is what brings them back
          to THIS invitation, the same `?return=` contract the proxy writes on expiry. */}
      <Callout
        intent={CALLOUT_INTENT.WARNING}
        title={t('wrongAccountTitle')}
        action={
          <form action={signOutAction.bind(null, links.returnPath)}>
            <Button type="submit">{t('signInAsInvited', { invited: invitation.invitedEmail })}</Button>
          </form>
        }
      >
        {t('wrongAccountBody', { invited: invitation.invitedEmail, current: signedInAs })}
      </Callout>
      <p className={`t-body-sm ${styles.altAction}`}>{t('wrongAccountAlternative')}</p>
    </div>
  );
}
