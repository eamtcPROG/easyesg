'use client';

import { Fieldset } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { formatFigure } from '@/lib/figure-format';
import { missingMonths, monthTotal } from '../../tools/month-total';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import styles from '../styles/calculator.module.css';
import { CommitField } from './commit-field';

/**
 * The monthly form (task 39.1; §12.5.6's task-39 row (1)): twelve rows, each labelled with the calendar month it stands
 * for, the running total beneath them, and **the empty months named** — the artboard's *"flags a missing month rather
 * than quietly summing eleven"*. A month left empty is not refused; the total says which months it leaves out.
 *
 * The total is a display of what the server will store (`month-total.ts`); the write leaves the quantity out and the
 * api sums the months itself.
 */
export function LineMonths({
  source,
  months,
  values,
  unit,
  readOnly,
  onMonth,
}: {
  /** The line's name, for the group's legend. */
  readonly source: string;
  /** The calendar months, `YYYY-MM`, the rows stand for. */
  readonly months: readonly string[];
  /** What each row holds, by position, or `null` before any is entered. */
  readonly values: readonly (string | null)[] | null;
  readonly unit: string | null;
  readonly readOnly: boolean;
  readonly onMonth: (input: { readonly index: number; readonly draft: string }) => string | null;
}) {
  const t = useTranslations(`${CALCULATOR_MESSAGES}.months`);
  const format = useFormatter();
  const entered = values ?? months.map(() => null);
  const monthName = (month: string): string =>
    // The first of the month at UTC midnight, formatted in UTC: a calendar month, which no zone can move (NFR-34).
    format.dateTime(new Date(`${month}-01T00:00:00Z`), { month: 'short', year: 'numeric', timeZone: 'UTC' });
  // A figure the reader reads, not one they type, is laid out for the locale — every digit kept (NFR-26).
  const figure = (value: string) => formatFigure({ value, places: undefined, format });
  const total = monthTotal(entered);
  const missing = missingMonths(entered);

  return (
    <Fieldset legend={t('legend', { source })} className={styles.months}>
      <div className={styles.monthGrid}>
        {months.map((month, index) =>
          readOnly ? (
            <p key={month} className={styles.monthValue}>
              <span>{monthName(month)}</span> <span>{entered[index] == null ? '—' : figure(entered[index])}</span>
            </p>
          ) : (
            <CommitField
              key={`${month} ${entered[index] ?? ''}`}
              label={t('month', { month: monthName(month) })}
              inputMode="decimal"
              value={entered[index] ?? ''}
              onCommit={(draft) => onMonth({ index, draft })}
            />
          ),
        )}
      </div>
      <p className={styles.monthTotal} aria-live="polite">
        {total === null ? t('noTotal') : t('total', { total: figure(total), unit: unit ?? '' })}
      </p>
      {total === null ? null : (
        <p className={styles.monthNote}>
          {missing.length === 0
            ? t('complete')
            : t('missing', { count: missing.length, months: missing.map((index) => monthName(months[index])).join(', ') })}
        </p>
      )}
    </Fieldset>
  );
}
