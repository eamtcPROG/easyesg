'use client';

import { Callout } from '@easyesg/ui';
import { NOTICE_REGION } from '../../../tools/access-state';
import { useAccess } from '../../shared/access-context';

/**
 * What the last action did, beside the list.
 *
 * §11.5 says a toast confirms *the user's own* action and these are exactly that — but the
 * inventory has no toast yet, so a `Callout` stands in. Recorded as a substitution rather than left
 * to look like a choice: when a second screen needs one, the toast is an inventory addition and
 * this becomes one line.
 */
export function AccessNotice() {
  const { notice } = useAccess();
  // One notice for the screen, rendered by the region it belongs to. A refusal of an invitation is
  // shown in the dialogue that covers this list, beside the form it refused; a sent one is shown
  // here, above the row it added — see `NOTICE_REGION`.
  if (notice?.region !== NOTICE_REGION.LIST) return null;

  return (
    <Callout intent={notice.intent} title={notice.title} action={notice.action}>
      {notice.body}
    </Callout>
  );
}
