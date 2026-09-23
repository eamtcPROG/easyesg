'use client';

import type { UnsubscribeAnswer } from '@easyesg/contracts';
import { Button, Callout, CALLOUT_INTENT, Panel } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import styles from '../../../shared/styles/identity-screens.module.css';
import { unsubscribeAction } from '../../actions/actions';
import { UNSUBSCRIBE_MESSAGES } from '../shared/unsubscribe-messages';

/**
 * S-38's one action (task 52.2.2; FR-169) — the only arm of the branch that changes anything.
 *
 * **The switch is an explicit press, never the render**: `ConfirmEmail`'s and `AcceptInvitation`'s rule, for the same
 * reason — the link arrives by email, and whatever follows it on the person's behalf must not act for them.
 *
 * One value with a lifecycle, not several: the outcome of the press, which is `undefined` until there is one (the
 * root file's *mutually exclusive → one value*). States (§8.1 subset): ready · pending — async · success · error —
 * recoverable (the api's own three-part wording) · unreachable.
 */
export function ConfirmUnsubscribe({ token, categoryName }: { token: string; categoryName: string | null }) {
  const t = useTranslations(UNSUBSCRIBE_MESSAGES);
  const tCommon = useTranslations('identity');
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<ApiOutcome<UnsubscribeAnswer> | undefined>(undefined);

  if (outcome?.status === API_OUTCOME.Ok) {
    return (
      <Callout intent={CALLOUT_INTENT.SUCCESS} title={t('doneTitle')} action={null}>
        {categoryName === null ? t('doneBodyUnnamed') : t('doneBody', { category: categoryName })}
      </Callout>
    );
  }

  const unsubscribe = () => {
    startTransition(async () => {
      setOutcome(await unsubscribeAction({ token }));
    });
  };

  return (
    <div className={styles.stack}>
      {outcome?.status === API_OUTCOME.Problem ? (
        // The api's own words, in the reader's language: its detail already says what to do next.
        <Callout intent={CALLOUT_INTENT.ERROR} title={outcome.problem.title ?? t('problemTitle')} action={null}>
          {outcome.problem.detail ?? t('problemBody')}
        </Callout>
      ) : null}

      {outcome?.status === API_OUTCOME.Unreachable ? (
        <Callout intent={CALLOUT_INTENT.ERROR} title={tCommon('unreachable.title')} action={tCommon('unreachable.action')}>
          {tCommon('unreachable.body')}
        </Callout>
      ) : null}

      <Panel className={styles.formPanel}>
        <p className={styles.bodyText}>
          {categoryName === null ? t('introUnnamed') : t('intro', { category: categoryName })}
        </p>
        <Button busy={pending} onClick={unsubscribe}>
          {t('confirm')}
        </Button>
      </Panel>
    </div>
  );
}
