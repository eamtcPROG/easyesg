'use client';

import { OverflowMenu } from '@easyesg/ui';
import { useTranslations } from 'next-intl';

/**
 * The bar's ⋯ at `compact` — the *S-07/S-08 narrow* frame's, holding the actions the wider bar draws as buttons
 * (task 179.1). The icon set is `packages/ui`'s alone (`architecture.md` §12.1), so this is its `OverflowMenu`.
 *
 * **Its items say they are not available yet, and are not `disabled`.** Radix skips a disabled item in a menu's keyboard
 * order, so a menu of two disabled items would open onto nothing a keyboard or screen-reader user could reach — the
 * reason would be unreadable exactly where it is needed. So each item is reachable and its words carry the whole
 * answer; choosing one closes the menu and does nothing else, which is what its label said it would do.
 *
 * Each item becomes the real action the day its screen ships, as `PendingAction` does in the wider bar.
 */
export function ReportOverflow() {
  const t = useTranslations('organization.wizard.bar');
  const nothing = () => undefined;

  return (
    <OverflowMenu
      label={t('more')}
      items={[
        { key: 'export', label: t('unavailableSuffix', { action: t('export') }), onSelect: nothing },
        { key: 'review', label: t('unavailableSuffix', { action: t('review') }), onSelect: nothing },
      ]}
    />
  );
}
