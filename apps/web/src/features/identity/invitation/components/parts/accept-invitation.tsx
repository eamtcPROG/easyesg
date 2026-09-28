'use client';

import { Button, CALLOUT_INTENT, ExpiringCallout, Panel, TextLink, useDismissible } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { API_OUTCOME } from '@/lib/api-outcome';
import { Link } from '@/i18n/navigation';
import { acceptInvitationAction } from '../../actions/actions';
import { INVITATION_REMEDY, type UsableInvitation } from '../../tools/invitation';
import type { AcceptInvitationFailure } from '../../actions/action-results';
import styles from '../../../shared/styles/identity-screens.module.css';

/**
 * S-03's primary action (UC-15, FR-11) — the one arm of the branch that changes anything.
 *
 * **The invitation is consumed by an explicit button, never on render**, which is
 * `ConfirmEmail`'s rule and the same reason: the link arrives by email, and a mail scanner or a
 * browser prefetching the URL must not spend somebody's single-use invitation. The preview above
 * this component reads without consuming, precisely so the page can render.
 *
 * **Success does not render here.** The action redirects to the joined organization's home, which
 * the API has already made the active one inside the acceptance transaction — so there is no
 * success state to draw and no client-side switch to remember. What crosses the RSC wire is only
 * the failure.
 *
 * States (§8.1 subset): rest (the invitation restated, one primary action) · accepting
 * (pending-async) · error — recoverable (the problem's own three-part text as received, per §8.4's
 * finding-to-destination rule) · unreachable (bundled catalogue).
 *
 * **The refusal's way out is the one the action resolved** (task 114): this screen is reached only
 * with a session, so the callout offered *"Go to sign in"* to someone who had one. The action now
 * says which fits — the reader's home page, or sign-in and back here when the session ended while
 * they were deciding.
 */
export function AcceptInvitation({
  token,
  invitation,
}: {
  token: string;
  invitation: UsableInvitation;
}) {
  const t = useTranslations('identity.invitation');
  const tCommon = useTranslations('identity');
  const tForms = useTranslations('forms');
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<AcceptInvitationFailure>(undefined);
  // A refusal leaves after a while, or when closed (design_spec.md §8.1, 28 Sep 2026); the next attempt's is a new
  // object and shows again.
  const [shownFailure, dismissFailure] = useDismissible(failure ?? null);

  const accept = () => {
    // The last refusal goes when the next attempt starts, so each answer's message is a fresh one with its own
    // dwell (design_spec.md §8.1, 28 Sep 2026) rather than inheriting the time the last one had left.
    setFailure(undefined);
    startTransition(async () => {
      setFailure(await acceptInvitationAction({ token }));
    });
  };

  return (
    <div className={styles.stack}>
      {shownFailure?.status === API_OUTCOME.Problem ? (
        // The API's own wording, in the reader's language, with the standing already folded into
        // it — a 410 here means the link was spent or withdrawn between the render and the press,
        // which is rare and is exactly what the detail explains.
        <ExpiringCallout
          intent={CALLOUT_INTENT.ERROR}
          dismissLabel={tForms('closeMessage')}
          onDismiss={dismissFailure}
          title={shownFailure.problem.title ?? t('problemTitle')}
          action={
            <TextLink asChild>
              <Link href={shownFailure.remedy.href}>
                {shownFailure.remedy.kind === INVITATION_REMEDY.HOME ? t('homeAction') : t('problemAction')}
              </Link>
            </TextLink>
          }
        >
          {shownFailure.problem.detail ?? t('problemBody')}
        </ExpiringCallout>
      ) : null}

      {shownFailure?.status === API_OUTCOME.Unreachable ? (
        <ExpiringCallout
          intent={CALLOUT_INTENT.ERROR}
          dismissLabel={tForms('closeMessage')}
          onDismiss={dismissFailure}
          title={tCommon('unreachable.title')}
          action={tCommon('unreachable.action')}
        >
          {tCommon('unreachable.body')}
        </ExpiringCallout>
      ) : null}

      <Panel className={styles.formPanel}>
        <p className={styles.bodyText}>
          {t('acceptIntro', {
            organization: invitation.organizationName,
            role: t(`role.${invitation.role}`),
          })}
        </p>
        <Button busy={pending} onClick={accept}>
          {t('accept')}
        </Button>
      </Panel>
    </div>
  );
}
