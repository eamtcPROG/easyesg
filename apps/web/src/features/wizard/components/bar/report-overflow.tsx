'use client';

import { OverflowMenu } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { BAR_ACTION, type BarAction } from '../../tools/bar-actions';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';

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
  const t = useTranslations(WIZARD_MESSAGES);
  const nothing = () => undefined;
  // The same two actions the wider bar draws, from the one declaration, each by its literal key.
  const names: Readonly<Record<BarAction, string>> = {
    [BAR_ACTION.EXPORT]: t('bar.export'),
    [BAR_ACTION.REVIEW]: t('bar.review'),
  };

  return (
    <OverflowMenu
      label={t('bar.more')}
      items={Object.values(BAR_ACTION).map((action) => ({
        key: action,
        label: t('bar.unavailableSuffix', { action: names[action] }),
        onSelect: nothing,
      }))}
    />
  );
}
