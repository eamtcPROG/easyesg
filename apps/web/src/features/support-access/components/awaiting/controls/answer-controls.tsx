'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import type { NoticeCopy } from '@/lib/notice';
import { declineSupportAccessAction, grantSupportAccessAction } from '../../../actions/actions';
import { RefusalCallout } from '../../shared/refusal-callout';
import { useSupportAccessAction } from '../../shared/use-support-access-action';
import styles from '../../styles/support-access.module.css';

/**
 * *Grant* and *Decline* (task 67.9). No confirmation dialogue: the banner above the buttons already states what a
 * grant does, and the grant's own label carries its length. **Both buttons wait on either answer**, because the
 * two cannot both be sent — the second would be refused as no longer waiting.
 */
export function AnswerControls({
  requestId,
  labels,
  unreachable,
}: {
  readonly requestId: string;
  readonly labels: { readonly grant: string; readonly decline: string };
  readonly unreachable: NoticeCopy;
}) {
  const { pending, refusal, run } = useSupportAccessAction(unreachable);

  return (
    <div className={styles.controls}>
      <div className={styles.buttons}>
        <Button
          type="button"
          disabled={pending}
          onClick={() => run(() => grantSupportAccessAction({ requestId }))}
        >
          {labels.grant}
        </Button>
        <Button
          type="button"
          variant={BUTTON_VARIANT.SECONDARY}
          disabled={pending}
          onClick={() => run(() => declineSupportAccessAction({ requestId }))}
        >
          {labels.decline}
        </Button>
      </div>
      {refusal === null ? null : <RefusalCallout notice={refusal} />}
    </div>
  );
}
