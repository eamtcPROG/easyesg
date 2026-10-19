'use client';

import { OverflowMenu } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { saveExport } from '@/client/exports/save-export';
import { reportRoute } from '@/lib/routes';
import { useReportDeletion } from '@/shared/report-deletion';
import type { ReportRow } from '../tools/reports';

/**
 * A row's ⋯ on S-06 (task 192; `design_spec.md` S-06's row, amended 19 Oct 2026) — the inventory's *Report actions*,
 * named for its row so a screen reader's list of menus names each report. It holds, in order:
 *
 * - **Open the report**, where the row's name goes (project owner, 19 Oct 2026);
 * - **Download the latest exported file**, on a filed row, for an editor or the administrator (task 216; 182/22 refuses
 *   a view-only member the file) — folded in from the row's own button on 19 Oct 2026, and still saved as a link saves
 *   it (`saveExport`);
 * - **Delete this report**, with its dialogue, for the Organization Administrator, set apart below the rule (task 192).
 *
 * Drawn wherever the list draws its actions column — for a member who may download or delete; one who may do neither
 * opens the report from its name and is given no menu that only repeats it.
 */
export function ReportRowMenu({
  row,
  canDownload,
  canDelete,
}: {
  readonly row: ReportRow;
  readonly canDownload: boolean;
  readonly canDelete: boolean;
}) {
  const t = useTranslations('organization.reports');
  const router = useRouter();
  const latest = canDownload ? (row.filed?.latestExportId ?? null) : null;
  const { item, dialogue } = useReportDeletion({
    id: row.id,
    entityName: row.entityName,
    fiscalYear: row.fiscalYear,
    archived: row.archived,
    locked: row.locked,
    exported: row.exported,
  });
  return (
    <>
      <OverflowMenu
        // The year as a string: ICU formats a number argument with grouping, which makes 2026 *2 026* (`i18n/formats.ts`).
        label={t('menu', { entity: row.entityName, year: String(row.fiscalYear) })}
        items={[
          { key: 'open', label: t('open'), onSelect: () => router.push(reportRoute(row.id)) },
          ...(latest === null ? [] : [{ key: 'download', label: t('filed.downloadLatest'), onSelect: () => saveExport(latest) }]),
          ...(canDelete ? [item] : []),
        ]}
      />
      {canDelete ? dialogue : null}
    </>
  );
}
