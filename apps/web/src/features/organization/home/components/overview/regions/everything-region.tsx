import type { AccountMembership } from '@easyesg/contracts';
import { getTranslations } from 'next-intl/server';
import { mayWrite } from '@/server/data/memberships';
import { everythingRows, type OverviewRow } from '../../../tools/overview';
import { FilingList } from './filing-list';
import { HomeRegion } from '../../shared/home-region';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import styles from '../../styles/home.module.css';

/**
 * UX-6's third question — *what is the state of everything* (UC-67, FR-23).
 *
 * **FR-23's own sentence is *every entity **and period***, which is why the row is a period rather
 * than a report**: since task 31.3 a report is an explicit creation, so a period with a deadline
 * nobody has started is exactly the row the readiness question most needs and the one
 * `GET /reports` cannot see.
 *
 * **It takes the screen's whole row set and applies its own order** (task 125), like its two
 * siblings: `everythingRows` is FR-23's answer and belongs with the region that answers it, not in
 * the section that composes them. The rows are already dated — the clock stays in the section.
 *
 * **Completion and validation status are drawn since task 42.2** (FR-23 AC-7): the standing reads readiness, and each
 * row's completion is the last run's summary, worded by `shared/report-completion.tsx` as S-06's column is. Until then
 * they were refused rather than drawn empty, as S-06 refused the same two columns.
 */
export async function EverythingRegion({
  rows,
  membership,
}: {
  /** Every row the screen has. The order is this region's own. */
  readonly rows: readonly OverviewRow[];
  /** What the section read. `canWrite` is derived here rather than handed down — see below. */
  readonly membership: AccountMembership | null;
}) {
  const t = await getTranslations(OVERVIEW_MESSAGES);
  // FR-25, through the predicate that lives beside the read — one rule, called where it is needed,
  // never a second spelling of it.
  const canWrite = mayWrite(membership);

  return (
    <HomeRegion heading={t('everything.heading')}>
      <p className={`t-body ${styles.lede}`}>{t('everything.lede')}</p>
      <FilingList rows={everythingRows(rows)} canWrite={canWrite} />
    </HomeRegion>
  );
}
