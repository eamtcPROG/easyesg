'use client';

import { Button, Callout, Panel, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { API_OUTCOME } from '@/lib/api-outcome';
import { Link } from '@/i18n/navigation';
import { acceptInvitationAction } from '../actions';
import type { UsableInvitation } from '../invitation';
import type { AcceptInvitationFailure } from '../types/action-results';
import styles from './identity-screens.module.css';
import { ROUTES } from '@/lib/routes';

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
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<AcceptInvitationFailure>(undefined);

  const accept = () => {
    startTransition(async () => {
      setFailure(await acceptInvitationAction({ token }));
    });
  };

  return (
    <div className={styles.stack}>
      {failure?.status === API_OUTCOME.Problem ? (
        // The API's own wording, in the reader's language, with the standing already folded into
        // it — a 410 here means the link was spent or withdrawn between the render and the press,
        // which is rare and is exactly what the detail explains.
        <Callout
          intent="error"
          title={failure.problem.title ?? t('problemTitle')}
          action={
            <TextLink asChild>
              <Link href={ROUTES.SIGN_IN}>{t('problemAction')}</Link>
            </TextLink>
          }
        >
          {failure.problem.detail ?? t('problemBody')}
        </Callout>
      ) : null}

      {failure?.status === API_OUTCOME.Unreachable ? (
        <Callout
          intent="error"
          title={tCommon('unreachable.title')}
          action={tCommon('unreachable.action')}
        >
          {tCommon('unreachable.body')}
        </Callout>
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
