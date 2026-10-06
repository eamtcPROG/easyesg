'use client';

import { CALLOUT_INTENT, Callout, ExpiringCallout, TextLink, useDismissible } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Link } from '@/i18n/navigation';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { failureNotice } from '@/lib/notice';
import { ROUTES } from '@/lib/routes';
import { dismissEnrolmentPromptAction } from '../../../actions/actions';
import styles from '../../styles/home.module.css';

/** The prompt's words — one reader, so declared here rather than in a `shared/` it would be alone in. */
const ENROLMENT_PROMPT_MESSAGES = 'organization.home.enrolmentPrompt';

/**
 * The prompt itself, and its two ways on (task 190): *set it up*, to S-28, where enrolment is; and *not now*, which the
 * account keeps for good until the factor is turned off.
 *
 * **A Client Component for *not now* alone**: the press is a Server Action whose success revalidates S-05, so the
 * prompt goes because the read now says so. Its one piece of state is the refusal, held as the outcome rather than a
 * flag, so a problem document the api sends is shown in its own words (`failureNotice`) and the prompt stays — the
 * truthful outcome — rather than a press that did nothing.
 */
export function EnrolmentPromptCallout() {
  const t = useTranslations(ENROLMENT_PROMPT_MESSAGES);
  const tForms = useTranslations('forms');
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [shownFailure, dismissFailure] = useDismissible(failure);

  const notNow = () => {
    setFailure(null);
    startTransition(async () => {
      const outcome = await dismissEnrolmentPromptAction();
      if (outcome.status !== API_OUTCOME.Ok) setFailure(outcome);
    });
  };

  const refusal =
    shownFailure === null
      ? null
      : failureNotice({
          outcome: shownFailure,
          unreachable: { title: t('notNowFailedTitle'), body: t('notNowFailedBody') },
        });

  return (
    <>
      {refusal === null ? null : (
        <ExpiringCallout
          intent={refusal.intent}
          title={refusal.title}
          action={refusal.action}
          dismissLabel={tForms('closeMessage')}
          onDismiss={dismissFailure}
        >
          {refusal.body}
        </ExpiringCallout>
      )}
      <Callout
        intent={CALLOUT_INTENT.ATTENTION}
        title={t('title')}
        action={
          <span className={styles.promptActions}>
            <TextLink asChild>
              <Link href={ROUTES.ACCOUNT_CREDENTIALS}>{t('setUp')}</Link>
            </TextLink>
            {/* A button wearing a link: it changes what the screen shows and goes nowhere. */}
            <TextLink asChild>
              <button type="button" onClick={notNow} disabled={pending} aria-busy={pending}>
                {t('notNow')}
              </button>
            </TextLink>
          </span>
        }
      >
        {t('body')}
      </Callout>
    </>
  );
}
