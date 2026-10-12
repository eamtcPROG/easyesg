'use client';

import type { Report } from '@easyesg/contracts';
import { OverflowMenu } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useReportDeletion } from '@/shared/report-deletion';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';

/**
 * The bar's ⋯ from `medium` up (task 192; `design_spec.md` S-07's amendment of 12 Oct 2026) — what the bar's buttons do
 * not hold, which is the administrator's *Delete this report* alone; below `medium` `ReportOverflow` holds it after
 * *Export* and *Review*. Drawn only for the Organization Administrator; the bar decides that.
 *
 * **Leaving is not guarded here**, as the exit's link and the preview's are: a deletion lands the reader on S-06 only
 * once the report is gone, and an answer still queued for a report being deleted has nowhere to go.
 */
export function ReportMenu({ report }: { readonly report: Report }) {
  const t = useTranslations(WIZARD_MESSAGES);
  const { item, dialogue } = useReportDeletion({
    id: report.id,
    entityName: report.subject.entityName,
    fiscalYear: report.subject.fiscalYear,
    locked: report.locked,
    exported: report.exported,
  });
  return (
    <>
      <OverflowMenu label={t('bar.more')} items={[item]} />
      {dialogue}
    </>
  );
}
