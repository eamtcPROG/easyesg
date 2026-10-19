'use client';

import { OverflowMenu } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { reportRoute } from '@/lib/routes';
import { useReportDeletion } from '@/shared/report-deletion';
import type { ReportRow } from '../tools/reports';

/**
 * A row's ⋯ on S-06 (task 192; `design_spec.md` S-06's amendment of 12 Oct 2026) — the inventory's *Report actions*,
 * named for its row so a screen reader's list of menus names each report, holding *Open the report* (19 Oct 2026,
 * project owner: the menu reaches the report as the row's name does) and *Delete this report* with its dialogue, set apart
 * below the rule. Drawn only for the Organization Administrator; the list decides that — a member with nothing else to
 * do on a row opens the report from its name, and gains no menu that only repeats it.
 */
export function ReportRowMenu({ row }: { readonly row: ReportRow }) {
  const t = useTranslations('organization.reports');
  const router = useRouter();
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
        label={t('deletion.menu', { entity: row.entityName, year: String(row.fiscalYear) })}
        items={[{ key: 'open', label: t('open'), onSelect: () => router.push(reportRoute(row.id)) }, item]}
      />
      {dialogue}
    </>
  );
}
