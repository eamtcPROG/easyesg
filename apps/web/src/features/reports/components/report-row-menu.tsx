'use client';

import { OverflowMenu } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useReportDeletion } from '@/shared/report-deletion';
import type { ReportRow } from '../tools/reports';

/**
 * A row's ⋯ on S-06 (task 192; `design_spec.md` S-06's amendment of 12 Oct 2026) — the inventory's *Report actions*,
 * named for its row so a screen reader's list of menus names each report, holding *Delete this report* and its dialogue.
 * Drawn only for the Organization Administrator; the list decides that.
 */
export function ReportRowMenu({ row }: { readonly row: ReportRow }) {
  const t = useTranslations('organization.reports.deletion');
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
      <OverflowMenu label={t('menu', { entity: row.entityName, year: String(row.fiscalYear) })} items={[item]} />
      {dialogue}
    </>
  );
}
