'use client';

import { ENTITY_STATUS, type Report } from '@easyesg/contracts';
import { OverflowMenu } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { reportExportRoute, reportPreviewRoute } from '@/lib/routes';
import { useReportDeletion } from '@/shared/report-deletion';
import { BAR_ACTION } from '../../tools/bar-actions';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';
import { useLeaveGuard } from '../shared/use-leave-guard';
import { useScopeLowering } from './use-scope-lowering';

/**
 * The bar's ⋯ at `compact` — the *S-07/S-08 narrow* frame's, holding the actions the wider bar draws as buttons
 * (task 179.1). The icon set is `packages/ui`'s alone (`architecture.md` §12.1), so this is its `OverflowMenu`.
 *
 * Both items are the real actions since task 47.3 — *Review the report* opening S-10 (task 43.2) and *Export* opening
 * S-11 — each by `useLeaveGuard`'s rule, as the bar's links do. ***Remove the Comprehensive Module* follows them since
 * task 78.3**, where the reader may lower the scope, and **the administrator's *Delete this report* last since task
 * 192**, set apart by a rule (`architecture.md` §12.5.6's task-192 row (3)); from `medium` up both are `ReportMenu`'s,
 * the bar's other ⋯.
 */
export function ReportOverflow({
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
  const { leave, guard } = useLeaveGuard();
  const reportId = report.id;
  // The administrator's *Delete this report*, last and set apart (task 192) — drawn only where it may be offered.
  const deletion = useReportDeletion({
    id: report.id,
    entityName: report.subject.entityName,
    fiscalYear: report.subject.fiscalYear,
    archived: report.subject.entityStatus === ENTITY_STATUS.ARCHIVED,
    locked: report.locked,
    exported: report.exported,
  });
  // UC-192's lowering (task 78.3), before the deletion — drawn only where it may be offered.
  const lowering = useScopeLowering({
    id: report.id,
    entityName: report.subject.entityName,
    fiscalYear: report.subject.fiscalYear,
    held,
  });

  // The same two actions the wider bar draws, from the one declaration, each opened by the rule the bar's own links
  // leave by: the preview (task 43.2) and the export (task 47.3).
  return (
    <>
      <OverflowMenu
        label={t('bar.more')}
        items={[
          {
            key: BAR_ACTION.REVIEW,
            label: t('bar.review'),
            onSelect: () => leave(reportPreviewRoute({ reportId })),
          },
          {
            key: BAR_ACTION.EXPORT,
            label: t('bar.export'),
            onSelect: () => leave(reportExportRoute({ reportId })),
          },
          ...(lowerable ? [lowering.item] : []),
          ...(mayDelete ? [deletion.item] : []),
        ]}
      />
      {guard}
      {lowerable ? lowering.dialogue : null}
      {mayDelete ? deletion.dialogue : null}
    </>
  );
}
