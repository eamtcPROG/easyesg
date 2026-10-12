import type { ReportRow } from '../tools/reports';
import { ReportDownload } from './report-download';
import { ReportRowMenu } from './report-row-menu';
import styles from './reports.module.css';

/**
 * The row's end: **a filed row's *Download*, for an editor or the administrator** (task 216; 182/22 refuses a view-only
 * member the file), **then the administrator's ⋯** (task 192). Every other row offers the subject's link alone, which
 * opens the report — so a member who may do neither has nothing here, and the list draws no column for them.
 */
export function ReportRowActions({
  row,
  canDownload,
  canDelete,
}: {
  readonly row: ReportRow;
  readonly canDownload: boolean;
  readonly canDelete: boolean;
}) {
  const latest = canDownload ? (row.filed?.latestExportId ?? null) : null;

  return (
    <span className={styles.rowActions}>
      {latest === null ? null : <ReportDownload row={row} exportId={latest} />}
      {canDelete ? <ReportRowMenu row={row} /> : null}
    </span>
  );
}
