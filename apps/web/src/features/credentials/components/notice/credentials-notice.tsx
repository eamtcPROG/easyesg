'use client';

import { ExpiringCallout, useDismissible } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { CREDENTIALS_STAGE } from '../../tools/credentials-state';
import { useCredentials } from '../shared/credentials-context';

/**
 * What the last action did, at the head of the record — **once every row is at rest** (task 169). A success closes its
 * row, so the head is where it is read; a refusal keeps its row open and is read there instead (`RowNotice`).
 *
 * **It leaves after a while, whatever it says** — the Expiring callout, `design_spec.md` §8.1 as amended 28 Sep 2026
 * by the project owner, as on S-16. `useDismissible` stops rendering the one the reader closed or outlasted; the
 * board's reducer still holds it, and the next action's notice is a new object that shows again.
 */
export function CredentialsNotice() {
  const t = useTranslations('forms');
  const { notice, stage } = useCredentials();
  const [shown, dismiss] = useDismissible(stage.kind === CREDENTIALS_STAGE.IDLE ? notice : null);
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
