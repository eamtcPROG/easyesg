'use client';

import type { ApiFailure, ReportValidationSummary } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, Callout, DateField, Panel } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useState, useTransition, type FormEvent } from 'react';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice } from '@/lib/notice';
import { markReportFiledAction } from '../../actions/actions';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';
import styles from '../styles/exports.module.css';

/** The panel's form is open or not, and an open one may hold why the last mark was refused — one value, not two. */
type FormState = { readonly open: false } | { readonly open: true; readonly failure: ApiFailure | null };

/**
 * *Mark as filed* (task 47.5; FR-41; `architecture.md` §12.5.6's task-47 row (4), (n)) — offered **once a file of the
 * report has been exported**, and before then the sentence saying so. Opened, it states what is being filed — the last
 * check's outstanding count, which gates nothing (182/27) — asks the day it was filed, today in the period's zone unless
 * the reporter says otherwise, and says what marking does not do: the lock alone freezes a report (row (2)). A mark that
 * succeeded redraws the screen from the server, where the mark replaces this panel.
 */
export function FilingPanel({
  reportId,
  exported,
  validation,
  today,
}: {
  readonly reportId: string;
  /** Whether any export of the report has completed (row (n)). */
  readonly exported: boolean;
  readonly validation: ReportValidationSummary | null;
  /** Today in the reporting period's zone, `YYYY-MM-DD` (NFR-34). */
  readonly today: string;
}) {
  const t = useTranslations(EXPORTS_MESSAGES);
  const titleId = useId();
  const [form, setForm] = useState<FormState>({ open: false });
  const [filedOn, setFiledOn] = useState(today);
  const [marking, startMarking] = useTransition();

  const mark = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (marking) return;
      setForm({ open: true, failure: null });
      startMarking(async () => {
        const outcome = await markReportFiledAction({ reportId, request: { filedOn } });
        if (outcome.status !== API_OUTCOME.Ok) setForm({ open: true, failure: outcome });
      });
    },
    [filedOn, marking, reportId],
  );

  const failed =
    form.open && form.failure !== null
      ? failureNotice({ outcome: form.failure, unreachable: { title: t('filing.unreachable.title'), body: t('filing.unreachable.body') } })
      : null;

  return (
    <section className={styles.region} aria-labelledby={titleId}>
      <h2 id={titleId} className={`t-heading-3 ${styles.sectionTitle}`}>
        {t('filing.title')}
      </h2>
      <p className={`t-body ${styles.note}`}>{t('filing.lede')}</p>
      {!exported ? (
        <p className={`t-body ${styles.note}`}>{t('filing.waiting')}</p>
      ) : !form.open ? (
        <div>
          <Button variant={BUTTON_VARIANT.SECONDARY} onClick={() => setForm({ open: true, failure: null })}>
            {t('filing.open')}
          </Button>
        </div>
      ) : (
        <Panel className={styles.panel}>
          {/* `method="post"` so a submit that beats hydration never puts the date in the address (task 96, NFR-30). */}
          <form className={styles.region} method="post" onSubmit={mark}>
            <p className="t-body-strong">
              {validation === null ? t('filing.unchecked') : t('filing.summary', { outstanding: validation.outstanding })}
            </p>
            <DateField
              label={t('filing.filedOn')}
              help={t('filing.filedOnHelp')}
              value={filedOn}
              required
              onChange={(event) => setFiledOn(event.target.value)}
            />
            <p className={`t-body ${styles.note}`}>{t('filing.consequence')}</p>
            {failed === null ? null : (
              <Callout intent={failed.intent} title={failed.title} action={failed.action}>
                {failed.body}
              </Callout>
            )}
            <div className={styles.commit}>
              <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => setForm({ open: false })}>
                {t('filing.notYet')}
              </Button>
              <Button type="submit" variant={BUTTON_VARIANT.PRIMARY} aria-disabled={marking || undefined}>
                {t('filing.submit')}
              </Button>
            </div>
          </form>
        </Panel>
      )}
    </section>
  );
}
