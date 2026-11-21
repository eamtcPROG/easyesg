import { getTranslations } from 'next-intl/server';
import type { OverviewRow } from '../../../tools/overview';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import { FilingRow } from './filing-row';
import styles from '../../styles/home.module.css';

/**
 * The artboard's table of filings (task 255): a header row, then one row per entity and period.
 *
 * **A list with a drawn header, not a `table` — and not the inventory's Data table.** The Data table is the Index
 * archetype's (sortable, filterable, paginated) and a client boundary, since its `cell` render functions cannot cross
 * the RSC boundary; this region has one order, its question's own, and buying sorting would make the most-visited
 * screen in the product a client boundary (UX-89's second step, answered by task 32.4 and still true). And a `table`
 * would have to stop being one at compact, where the 390 artboard draws a list: so the rows are list items that read
 * in order — the name, the year, the state, the last activity, the action — and the header is the eye's alone,
 * hidden from assistive technology, with the one cell whose value does not say what it is carrying a hidden label.
 */
export async function FilingTable({
  rows,
  canWrite,
}: {
  readonly rows: readonly OverviewRow[];
  readonly canWrite: boolean;
}) {
  const t = await getTranslations(`${OVERVIEW_MESSAGES}.everything.columns`);

  return (
    <>
      <div className={styles.tableHead} aria-hidden="true">
        <span>{t('entity')}</span>
        <span>{t('period')}</span>
        <span>{t('state')}</span>
        <span className={styles.headActivity}>{t('activity')}</span>
        {/* The action column, unheaded as the artboard leaves it: each cell says what it does. */}
        <span />
      </div>
      <ul className={styles.table}>
        {rows.map((row) => (
          <FilingRow key={row.periodId} row={row} canWrite={canWrite} />
        ))}
      </ul>
    </>
  );
}
