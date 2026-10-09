'use client';

import { OverflowMenu } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { reportPreviewRoute } from '@/lib/routes';
import { BAR_ACTION } from '../../tools/bar-actions';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';
import { useLeaveGuard } from './use-leave-guard';

/**
 * The bar's ⋯ at `compact` — the *S-07/S-08 narrow* frame's, holding the actions the wider bar draws as buttons
 * (task 179.1). The icon set is `packages/ui`'s alone (`architecture.md` §12.1), so this is its `OverflowMenu`.
 *
 * **An item not available yet says so, and is not `disabled`.** Radix skips a disabled item in a menu's keyboard order,
 * so the reason would be unreadable exactly where it is needed. So it is reachable and its words carry the whole answer;
 * choosing it closes the menu and does nothing else, which is what its label said it would do.
 *
 * Each item becomes the real action the day its screen ships, as in the wider bar: *Review the report* since task 43.2,
 * which opens S-10 by `useLeaveGuard`'s rule, as the bar's link does.
 */
export function ReportOverflow({ reportId }: { readonly reportId: string }) {
  const t = useTranslations(WIZARD_MESSAGES);
  const { leave, guard } = useLeaveGuard();
  const nothing = () => undefined;

  // The same two actions the wider bar draws, from the one declaration: the preview opened (task 43.2) by the rule the
  // bar's own link leaves by, and the export still ahead of its screen.
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
            label: t('bar.unavailableSuffix', { action: t('bar.export') }),
            onSelect: nothing,
          },
        ]}
      />
      {guard}
    </>
  );
}
