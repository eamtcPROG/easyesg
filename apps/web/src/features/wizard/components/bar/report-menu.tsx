'use client';

import { ENTITY_STATUS, type Report } from '@easyesg/contracts';
import { OverflowMenu } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useReportDeletion } from '@/shared/report-deletion';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';
import { useScopeLowering } from './use-scope-lowering';

/**
 * The bar's ⋯ from `medium` up (task 192; `design_spec.md` S-07's amendments of 12 and 27 Oct 2026) — what the bar's
 * buttons do not hold: *Remove the Comprehensive Module* where the reader may lower the scope (task 78.3), then the
 * administrator's *Delete this report*; below `medium` `ReportOverflow` holds both after *Export* and *Review*. The bar
 * draws this only where one of the two is offered.
 *
 * **Leaving is not guarded here**, as the exit's link and the preview's are: a deletion lands the reader on S-06 only
 * once the report is gone, and an answer still queued for a report being deleted has nowhere to go; lowering lands on
 * the report itself, a step change, which abandons nothing.
 */
export function ReportMenu({
  report,
  mayDelete,
  lowerable,
  held,
}: {
  readonly report: Report;
  readonly mayDelete: boolean;
  /** The reader may remove the Comprehensive Module (`scopeChangeOffered`). */
  readonly lowerable: boolean;
  /** The Comprehensive modules holding answers, which the lowering's dialogue names. */
  readonly held: readonly string[];
}) {
  const t = useTranslations(WIZARD_MESSAGES);
  const deletion = useReportDeletion({
    id: report.id,
    entityName: report.subject.entityName,
    fiscalYear: report.subject.fiscalYear,
    archived: report.subject.entityStatus === ENTITY_STATUS.ARCHIVED,
    locked: report.locked,
    exported: report.exported,
  });
  const lowering = useScopeLowering({
    id: report.id,
    entityName: report.subject.entityName,
    fiscalYear: report.subject.fiscalYear,
    held,
  });
  return (
    <>
      <OverflowMenu
        label={t('bar.more')}
        items={[...(lowerable ? [lowering.item] : []), ...(mayDelete ? [deletion.item] : [])]}
      />
      {lowerable ? lowering.dialogue : null}
      {mayDelete ? deletion.dialogue : null}
    </>
  );
}
