import { STATUS_TONE, StatusChip, type StatusTone } from '@easyesg/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { calendarDayOf } from '@/lib/legal-date';
import { ReportCompletion } from '@/shared/report-completion';
import { OVERVIEW_STANDING, type OverviewRow, type OverviewStanding } from '../../../tools/overview';
import { FilingAction } from '../shared/filing-action';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import styles from '../../styles/home.module.css';

/**
 * The tone says **what this row asks of the reader**, and it agrees with S-06's map wherever the two vocabularies
 * overlap — two screens disagreeing about what *locked* looks like is worse than either choice. `not_started`,
 * `open` and `locked` share *neutral* and are told apart by their words (UX-102); `locked` in particular is not
 * alarming, since locking is the deliberate act that gives a filing a defensible endpoint. What *is* alarming is a
 * deadline that has passed, which is its own chip. Exhaustive by `Record`: a status added to the contract fails here.
 */
const STANDING_TONE: Record<OverviewStanding, StatusTone> = {
  [OVERVIEW_STANDING.NOT_STARTED]: STATUS_TONE.NEUTRAL,
  [OVERVIEW_STANDING.IN_PROGRESS]: STATUS_TONE.NEUTRAL,
  [OVERVIEW_STANDING.LOCKED]: STATUS_TONE.NEUTRAL,
  [OVERVIEW_STANDING.READY_TO_FILE]: STATUS_TONE.PENDING,
  [OVERVIEW_STANDING.FILED]: STATUS_TONE.POSITIVE,
};

/**
 * One filing — entity, year and due date, its standing with its completion, its last activity, and the one thing
 * this reader can do with it (UC-67, FR-23; task 255, from `filing-list.tsx`'s row of task 32.4).
 *
 * **Completion and validation status beside the chip, in S-06's words** (FR-23 AC-7, task 42.2): the artboard folds
 * them into the chip (*Draft · 7 of 11*), and S-05's spec says each row's completion is the last run's summary *worded
 * as S-06's column is* — so the chip keeps the standing and `shared/report-completion.tsx`, S-06's own column, says how
 * far the run found the report, what it left to fix, or that none has looked. A period with no report has nothing to
 * complete, and the standing says so.
 *
 * **Overdue is a second chip rather than a tone on the first**, because it is a different fact: *what state is this
 * filing in* and *has its deadline passed* are independent, and folding them would lose one of the two.
 */
export async function FilingRow({ row, canWrite }: { readonly row: OverviewRow; readonly canWrite: boolean }) {
  const [t, tStanding, tColumns, format] = await Promise.all([
    getTranslations(OVERVIEW_MESSAGES),
    // Narrow namespaces, so a template-literal key is a union of a few leaves rather than every leaf of the overview.
    getTranslations(`${OVERVIEW_MESSAGES}.standing`),
    getTranslations(`${OVERVIEW_MESSAGES}.everything.columns`),
    getFormatter(),
  ]);


  return (
    <li className={styles.tableRow}>
      <span className={styles.cellName}>{row.entityName}</span>

      <span className={styles.cellPeriod}>
        {/* A string, never a number: ICU would print `2026` as "2 026" in `ro` and `ru`. */}
        <span className="t-body">{String(row.fiscalYear)}</span>
        <span className={`t-caption ${styles.muted}`}>
          {row.due === null ? t('dueNone') : t('due', { date: format.dateTime(calendarDayOf(row.due), 'calendar') })}
        </span>
      </span>

      <span className={styles.cellState}>
        <StatusChip tone={STANDING_TONE[row.standing]}>{tStanding(row.standing)}</StatusChip>
        {row.overdue ? <StatusChip tone={STATUS_TONE.ATTENTION}>{t('overdue')}</StatusChip> : null}
        {row.reportId === null ? null : <ReportCompletion validation={row.validation} />}
      </span>

      <span className={`t-caption ${styles.cellActivity}`}>
        {/* The column's name, for a reader who meets the date without the header the eye has. */}
        <span className={styles.visuallyHidden}>{tColumns('activity')}</span>{' '}
        {row.lastActivity === null ? t('everything.noActivity') : format.dateTime(new Date(row.lastActivity), 'short')}
      </span>

      <span className={styles.cellAction}>
        <FilingAction row={row} canWrite={canWrite} />
      </span>
    </li>
  );
}
