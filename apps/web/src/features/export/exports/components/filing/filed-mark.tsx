'use client';

import type { ApiFailure, ReportFiling } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useState, useTransition } from 'react';
import { API_OUTCOME } from '@/lib/api-outcome';
import { calendarDay } from '@/lib/legal-date';
import { failureNotice } from '@/lib/notice';
import { withdrawReportFilingAction } from '../../actions/actions';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';

/**
 * The report's filed mark (task 47.5; FR-41; `architecture.md` §12.5.6's task-47 row (1)–(4)): the day the reporter
 * said it was filed, who marked it and when — the person by the name they bear now, an erased account by no name — and
 * the mark's withdrawal, by an editor or the administrator and with no reason asked (row (3)). A withdrawal that
 * succeeded redraws the screen from the server, where the mark is gone and the panel to make one is back.
 */
export function FiledMark({ reportId, filing }: { readonly reportId: string; readonly filing: ReportFiling }) {
  const t = useTranslations(EXPORTS_MESSAGES);
  const format = useFormatter();
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [withdrawing, startWithdrawal] = useTransition();

  const withdraw = useCallback(() => {
    if (withdrawing) return;
    setFailure(null);
    startWithdrawal(async () => {
      const outcome = await withdrawReportFilingAction({ reportId });
      if (outcome.status !== API_OUTCOME.Ok) setFailure(outcome);
    });
  }, [reportId, withdrawing]);

  const failed =
    failure === null
      ? null
      : failureNotice({ outcome: failure, unreachable: { title: t('filing.unreachable.title'), body: t('filing.unreachable.body') } });

  return (
    <>
      <Callout
        intent={CALLOUT_INTENT.SUCCESS}
        title={t('filing.filed.title', { date: format.dateTime(calendarDay(filing.filedOn), 'calendar') })}
        action={
          <Button variant={BUTTON_VARIANT.SECONDARY} onClick={withdraw} aria-disabled={withdrawing || undefined}>
            {t('filing.filed.withdraw')}
          </Button>
        }
      >
        {t('filing.filed.body', {
          person: filing.filedBy.name ?? t('filing.filed.personUnknown'),
          at: format.dateTime(filing.filedAt, 'stamp'),
        })}
      </Callout>
      {failed === null ? null : (
        <Callout intent={failed.intent} title={failed.title} action={failed.action}>
          {failed.body}
        </Callout>
      )}
    </>
  );
}
