'use client';

import { ExpiringCallout, useDismissible } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { NOTICE_REGION } from '../../../tools/access-state';
import { useAccess } from '../../shared/access-context';

/**
 * What the last action did, beside the list.
 *
 * **It leaves after a while, whatever it says** — the Expiring callout, `design_spec.md` §8.1 as amended 28 Sep 2026
 * by the project owner. `useDismissible` stops rendering the one the reader closed or outlasted; the board's reducer
 * still holds it, and the next action's notice is a new object that shows again.
 */
export function AccessNotice() {
  const t = useTranslations('forms');
  const { notice } = useAccess();
  // One notice for the screen, rendered by the region it belongs to. A refusal of an invitation is
  // shown in the dialogue that covers this list, beside the form it refused; a sent one is shown
  // here, above the row it added — see `NOTICE_REGION`.
  const [shown, dismiss] = useDismissible(notice?.region === NOTICE_REGION.LIST ? notice : null);
  if (shown === null) return null;

  return (
    <ExpiringCallout
      intent={shown.intent}
      title={shown.title}
      action={shown.action}
      dismissLabel={t('closeMessage')}
      onDismiss={dismiss}
    >
      {shown.body}
    </ExpiringCallout>
  );
}
