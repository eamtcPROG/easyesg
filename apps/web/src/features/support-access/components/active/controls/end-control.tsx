'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import type { NoticeCopy } from '@/lib/notice';
import { endSupportAccessAction } from '../../../actions/actions';
import { RefusalCallout } from '../../shared/refusal-callout';
import { useSupportAccessAction } from '../../shared/use-support-access-action';
import styles from '../../styles/support-access.module.css';

/**
 * *End access now*, an Organization Administrator's (task 67.9). No confirmation: ending takes nothing from the
 * organization and gives nothing away — the operator can ask again, with a new reason, which needs a new grant.
 */
export function EndControl({
  requestId,
  label,
  unreachable,
}: {
  readonly requestId: string;
  readonly label: string;
  readonly unreachable: NoticeCopy;
}) {
  const { pending, refusal, run } = useSupportAccessAction(unreachable);

  return (
    <div className={styles.controls}>
      <Button
        type="button"
        variant={BUTTON_VARIANT.SECONDARY}
        busy={pending}
        onClick={() => run(() => endSupportAccessAction({ requestId }))}
      >
        {label}
      </Button>
      {refusal === null ? null : <RefusalCallout notice={refusal} />}
    </div>
  );
}
