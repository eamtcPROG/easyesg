'use client';

import type { UnsubscribeAnswer } from '@easyesg/contracts';
import { Button, Callout, CALLOUT_INTENT, Panel, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Link } from '@/i18n/navigation';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { failureNotice } from '@/lib/notice';
import { ROUTES } from '@/lib/routes';
import { RecordNotice } from '@/shared/record-notice';
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
export function ConfirmUnsubscribe({
  token,
  categoryName,
  recipient,
}: {
  token: string;
  categoryName: string | null;
  recipient: string;
}) {
  const t = useTranslations(UNSUBSCRIBE_MESSAGES);
  const tCommon = useTranslations('identity');
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<ApiOutcome<UnsubscribeAnswer> | undefined>(undefined);

  if (outcome?.status === API_OUTCOME.Ok) {
    return (
      // Its way on is S-27 since task 52.3, where the choice is reversed.
      <Callout
        intent={CALLOUT_INTENT.SUCCESS}
        title={t('doneTitle')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.ACCOUNT_PREFERENCES}>{t('profileAction')}</Link>
          </TextLink>
        }
      >
        {categoryName === null
          ? t('doneBodyUnnamed', { recipient })
          : t('doneBody', { category: categoryName, recipient })}
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
      {/* One notice for either failure, through `@/lib/notice`'s rule: the api's own words member by member where it
          answered, and the bundled unreachable copy where it did not (task 52's close review). */}
      <RecordNotice
        notice={
          outcome === undefined
            ? null
            : outcome.status === API_OUTCOME.Unreachable
              ? failureNotice({
                  outcome,
                  unreachable: { title: tCommon('unreachable.title'), body: tCommon('unreachable.body') },
                  action: tCommon('unreachable.action'),
                })
              : failureNotice({ outcome, unreachable: { title: t('problemTitle'), body: t('problemBody') } })
        }
      />

      <Panel className={styles.formPanel}>
        <p className={styles.bodyText}>
          {categoryName === null
            ? t('introUnnamed', { recipient })
            : t('intro', { category: categoryName, recipient })}
        </p>
        <Button busy={pending} onClick={unsubscribe}>
          {t('confirm')}
        </Button>
      </Panel>
    </div>
  );
}
