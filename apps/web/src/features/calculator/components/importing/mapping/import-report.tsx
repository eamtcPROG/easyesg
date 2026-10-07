'use client';

import { Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { IMPORT_PLAN, type ImportPlan } from '../../../tools/import-plan';
import styles from '../../styles/calculator.module.css';
import { IMPORT_MESSAGES } from '../shared/import-messages';

/**
 * What the import will do, before it does it (task 204.2; FR-211's behaviour 6; `architecture.md` §12.5.6's task-204
 * row (4)): how many lines it will add, and every row it cannot read, by its row number in the file and what is
 * wrong with it — or why nothing can be imported from this sheet.
 *
 * **NFR-79's three parts, split where each is true.** The callout's title says what happened (how many rows cannot be
 * read) and its body the consequence (they are not imported); each row says what is wrong with it and what puts it
 * right, because the remedy differs by row — match a value above, or correct the file. A sheet that cannot be
 * imported at all is one refusal with all three. While a column a line needs is unchosen there is nothing to report:
 * the select says what is missing, where it is missing.
 */
export function ImportReport({ plan }: { readonly plan: ImportPlan }) {
  const t = useTranslations(IMPORT_MESSAGES);
  switch (plan.kind) {
    case IMPORT_PLAN.REFUSED:
      return (
        <Callout
          intent={CALLOUT_INTENT.ERROR}
          title={t(`refused.${plan.refusal}.title`)}
          action={t(`refused.${plan.refusal}.action`)}
        >
          {t(`refused.${plan.refusal}.body`)}
        </Callout>
      );
    case IMPORT_PLAN.INCOMPLETE:
      return null;
    case IMPORT_PLAN.READY:
      return (
        <div className={styles.importingReport}>
          <p className={styles.importingReady} role="status">
            {t('ready', { lines: plan.lines.length })}
          </p>
          {plan.unreadable.length === 0 ? null : (
            <Callout
              intent={CALLOUT_INTENT.ATTENTION}
              title={t('unreadable.title', { rows: plan.unreadable.length })}
              action={null}
            >
              <p>{t('unreadable.body')}</p>
              <ul className={styles.importingRows}>
                {plan.unreadable.map((row) => (
                  <li key={row.number}>
                    <span className={styles.importingRowNumber}>{t('unreadable.row', { number: row.number })}</span>{' '}
                    {t(`unreadable.problems.${row.problem}`, { value: row.value ?? '' })}
                  </li>
                ))}
              </ul>
            </Callout>
          )}
        </div>
      );
  }
}
