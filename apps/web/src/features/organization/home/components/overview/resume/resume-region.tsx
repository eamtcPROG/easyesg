import type { AccountMembership } from '@easyesg/contracts';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { resumableRow, type OverviewRow } from '../../../tools/overview';
import { OverviewRegion } from '../shared/overview-region';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import { ResumeCard } from './resume-card';
import { ResumeCardLoading } from './resume-card-loading';
import styles from '../../styles/home.module.css';

/**
 * UX-6's second question — *where did I leave off* (UC-67) — as the artboard's resume card, the largest thing on the
 * page, because the primary object is a report in progress (task 255).
 *
 * **Still one report, never a fourth copy of the row.** UX-6 says a single-entity organization *"reduces to one
 * resumable report and its completion state"*, and the multi-entity artboard keeps it one card too — one person
 * resumes one thing. What changed is what the card says about that one report: its modules, one by one, and the one
 * where work stopped, where task 32.4 drew a sentence and a link.
 *
 * **No row, no box** — UX-6 orders three questions rather than requiring three boxes, so a screen with nothing to
 * resume answers the second with nothing at all, and the region decides that itself (task 125).
 *
 * **The card reads, so the card has a boundary of its own.** The module summaries and the last validation run are
 * reads nothing else on the screen makes, and they are made only once the overview has said which report this is, so
 * they wait behind the overview's read; a boundary here lets the attention list and the table paint meanwhile, with
 * the card's skeleton holding the strip's geometry (the loading artboard's own note). The label and *last saved* need
 * none of that, so they stand outside it.
 */
export async function ResumeRegion({
  rows,
  membership,
}: {
  readonly rows: readonly OverviewRow[];
  /** Whether the card says *continue* or *open*, through FR-25's one predicate. */
  readonly membership: AccountMembership | null;
}) {
  const row = resumableRow(rows);
  if (row === null) return null;

  const [t, format] = await Promise.all([getTranslations(OVERVIEW_MESSAGES), getFormatter()]);

  return (
    <OverviewRegion
      heading={t('resume.heading')}
      // The report's last activity, an instant (OQ-50) formatted in the configured zone — the artboard's *Autosaved*.
      meta={row.lastActivity === null ? null : t('resume.saved', { at: format.dateTime(new Date(row.lastActivity), 'stamp') })}
      place={styles.resumeRegion}
    >
      <Suspense fallback={<ResumeCardLoading />}>
        <ResumeCard row={row} membership={membership} />
      </Suspense>
    </OverviewRegion>
  );
}
