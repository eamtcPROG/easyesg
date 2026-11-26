import { TextLink } from '@easyesg/ui';
import type { AccountMembership } from '@easyesg/contracts';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { mayWrite } from '@/server/data/memberships';
import { everythingRows, type OverviewRow } from '../../../tools/overview';
import { OverviewRegion } from '../shared/overview-region';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import { FilingTable } from './filing-table';
import styles from '../../styles/home.module.css';

/**
 * UX-6's third question — *what is the state of everything* (UC-67, FR-23) — as the artboard's table (task 255).
 *
 * **FR-23's own sentence is *every entity **and period***, which is why a row is a period rather than a report**:
 * since task 31.3 a report is an explicit creation, so a period with a deadline nobody has started is exactly the row
 * the readiness question most needs and the one `GET /reports` cannot see. *All reports* at the label's end is S-06,
 * the Index this table summarizes, as the artboard links it.
 *
 * **It takes the screen's whole row set and applies its own order** (task 125): `everythingRows` is FR-23's answer and
 * belongs with the region that answers it. The rows are already dated — the clock stays in the read.
 */
export async function EverythingRegion({
  rows,
  membership,
}: {
  /** Every row the screen has. The order is this region's own. */
  readonly rows: readonly OverviewRow[];
  /** What the section read. `canWrite` is derived here, through FR-25's one predicate. */
  readonly membership: AccountMembership | null;
}) {
  const t = await getTranslations(OVERVIEW_MESSAGES);

  return (
    <OverviewRegion
      heading={t('everything.heading')}
      meta={
        <TextLink asChild>
          <Link href={ROUTES.REPORTS}>{t('everything.allReports')}</Link>
        </TextLink>
      }
      place={styles.everythingRegion}
    >
      <div className={styles.card}>
        <FilingTable rows={everythingRows(rows)} canWrite={mayWrite(membership)} />
      </div>
    </OverviewRegion>
  );
}
