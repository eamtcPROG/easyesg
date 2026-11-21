import { TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES, reportRoute, withQuery } from '@/lib/routes';
import type { OverviewRow } from '../../../tools/overview';
import { OVERVIEW_MESSAGES } from './overview-messages';
import styles from '../../styles/home.module.css';

/**
 * The one thing a reader can do with a filing — open its report, start one, or be told why neither — wherever S-05
 * draws a filing (task 255; it was `filing-list.tsx`'s last cell since task 32.4).
 *
 * **In `overview/shared/` on one test: is it read by more than one sibling?** `attention/` ends each filing's sentence
 * with it, as the artboard ends *Open B3*, and `everything/` gives it the table's last column. One rule in two places
 * would be the drift task 32.4 recorded between two spellings of FR-25.
 *
 * **Opening a report is a read for everybody** — S-07 draws its own read-only state (`READ_ONLY_CAUSE`) — while
 * starting one is a write `POST /reports` refuses a viewer, so a viewer is offered no start: the control that cannot
 * act. **UX-13 in terms**: a locked period (UC-57) and an archived entity (FR-20, task 187) both remove the start,
 * and each says so rather than leaving an identical row with no explanation; the archive is named first, since the
 * entity takes no new report whatever the period's lock. A viewer's own standing is the global tier's to state once
 * rather than this row's to repeat. The third cause, a suspended entitlement (UC-142), is task 54's and is absent
 * rather than guessed at.
 */
export async function FilingAction({
  row,
  canWrite,
}: {
  readonly row: OverviewRow;
  /** FR-25, as `mayWrite` answered it for the membership the section read. */
  readonly canWrite: boolean;
}) {
  const t = await getTranslations(OVERVIEW_MESSAGES);

  if (row.reportId !== null) {
    return (
      <TextLink asChild>
        {/* The report's own address, never a step: task 35.3's redirector resolves where work last happened. */}
        <Link href={reportRoute(row.reportId)}>{t('open')}</Link>
      </TextLink>
    );
  }

  if (canWrite && !row.periodLocked && !row.entityArchived) {
    return (
      <TextLink asChild>
        {/* The creation flow's own address, with the entity already chosen — its decisions ride the query string
            precisely so a half-made one is a link. */}
        <Link href={withQuery(ROUTES.REPORT_NEW, `entity=${row.entityId}`)}>{t('start')}</Link>
      </TextLink>
    );
  }

  const cause = row.entityArchived ? t('entityArchived') : row.periodLocked ? t('periodLocked') : null;
  return cause === null ? null : <span className={`t-caption ${styles.muted}`}>{cause}</span>;
}
