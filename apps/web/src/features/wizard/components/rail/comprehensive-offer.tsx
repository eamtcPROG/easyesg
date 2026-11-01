'use client';

import { REPORT_SCOPE, type ApiFailure } from '@easyesg/contracts';
import { ExpiringCallout, TextLink, useDismissible } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice } from '@/lib/notice';
import { reportStepRoute } from '@/lib/routes';
import { changeScopeAction } from '../../actions/actions';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';
import styles from './module-rail.module.css';

/** The module the reader lands on once the Comprehensive Module is added — frame *20 · S-07*'s. */
const FIRST_COMPREHENSIVE_MODULE = 'C1';

/**
 * *Add C1 – C9* — UC-192 from the module list of a Basic report (task 78.3; `design_spec.md` S-07's amendment of
 * 27 Oct 2026; `architecture.md` §12.5.6's task-78 row (2)), as `EasyESG Reporting Screens.dc.html` draws it beneath
 * the Basic group. **Taken at once, with no dialogue**: adding loses nothing, and every B answer stays as it was. It
 * lands on C1, the step the added module begins with.
 *
 * **A refusal stays here**, an Expiring callout beneath the link that asked — a lock or an archive set since the step
 * was read, or an outage — since the list is where the reader is looking. One `useState` for it, the reducer rule's
 * carve-out: a single value with a lifecycle, cleared on the press and set on the answer.
 *
 * **The section offers it only to a reader who may write a report that is Basic**, so this draws no reason of its own.
 */
export function ComprehensiveOffer({ reportId }: { readonly reportId: string }) {
  const t = useTranslations(WIZARD_MESSAGES);
  const tForms = useTranslations('forms');
  const router = useRouter();
  const [adding, startAdding] = useTransition();
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [shown, dismiss] = useDismissible(failure);

  const add = () => {
    setFailure(null);
    startAdding(async () => {
      const outcome = await changeScopeAction({ reportId, scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE });
      if (outcome.status === API_OUTCOME.Ok) {
        // A step change, so nothing unsent is abandoned: the queue drains on the next step's mount (task 35.2).
        router.push(reportStepRoute({ reportId, module: FIRST_COMPREHENSIVE_MODULE }));
        return;
      }
      setFailure(outcome);
    });
  };

  const notice =
    shown === null
      ? null
      : failureNotice({
          outcome: shown,
          unreachable: { title: t('rail.offer.unreachable.title'), body: t('rail.offer.unreachable.body') },
        });

  return (
    <div className={styles.offer}>
      <p className={styles.offerText}>{t('rail.offer.absent')}</p>
      <TextLink asChild>
        <button type="button" className={styles.offerAction} onClick={add} disabled={adding} aria-busy={adding}>
          {t('rail.offer.add')}
        </button>
      </TextLink>
      {notice === null ? null : (
        <ExpiringCallout
          intent={notice.intent}
          title={notice.title}
          action={notice.action}
          dismissLabel={tForms('closeMessage')}
          onDismiss={dismiss}
        >
          {notice.body}
        </ExpiringCallout>
      )}
    </div>
  );
}
