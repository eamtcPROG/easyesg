import { getFormatter, getTranslations } from 'next-intl/server';
import { calendarDayOf } from '@/lib/legal-date';
import { readOverviewRows } from '@/server/data/overview';
import { TENANT_READ } from '@/server/data/tenant-read';
import { nextDeadline } from '../../tools/overview';
import { RailCard } from '../shared/rail-card';
import styles from '../styles/home.module.css';

/** The card's namespace — read by this file alone, so declared here rather than in a `shared/` it would be alone in. */
const DEADLINE_MESSAGES = 'organization.home.deadline';

/**
 * The rail's *Filing deadline* card on S-05's artboard (task 255): the next date an unsettled filing is due, how far
 * away it is, and whose filing it is.
 *
 * **The date is the filing's own** — FR-21's due date, set per period — and never a statute this screen recites: the
 * artboard's sentence cites the law that sets the 2026 date, which is a regulatory fact the period's configuration
 * already carries and this card cannot verify, so it says only what the data says (`nextDeadline` says which date).
 * **Days are counted in the due date's own zone** (NFR-34), by the same read and at the same instant as the attention
 * list's *overdue*, so the two never disagree about which side of the date a filing is on.
 *
 * **It draws nothing where the overview draws its own arm** — a read that failed, or an organization with no period
 * yet — since the overview's card already says what happened there, and a second card saying it again in the rail
 * would only repeat it. Where every unsettled filing is undated it says so, which is a real and common state.
 */
export async function DeadlineSection() {
  const [read, t, format] = await Promise.all([
    readOverviewRows(),
    getTranslations(DEADLINE_MESSAGES),
    getFormatter(),
  ]);

  if (read.status !== TENANT_READ.READY || read.rows.length === 0) return null;

  const next = nextDeadline(read.rows);
  if (next === null) {
    return (
      <RailCard heading={t('heading')}>
        <p className={`t-body ${styles.deadlineText}`}>{t('none')}</p>
      </RailCard>
    );
  }

  const [only] = next.rows;
  const subject =
    next.rows.length === 1 && only !== undefined
      ? t('subjectOne', { entity: only.entityName, year: String(only.fiscalYear) })
      : t('subjectMany', { count: next.rows.length });

  return (
    <RailCard heading={t('heading')}>
      <p className={`t-heading-1 ${styles.deadlineDate}`}>{format.dateTime(calendarDayOf(next.due), 'calendar')}</p>
      <p className={`t-caption ${styles.deadlineText}`}>
        {next.dueInDays >= 0
          ? t('upcoming', { days: next.dueInDays, subject })
          : t('passed', { days: -next.dueInDays, subject })}
      </p>
    </RailCard>
  );
}
