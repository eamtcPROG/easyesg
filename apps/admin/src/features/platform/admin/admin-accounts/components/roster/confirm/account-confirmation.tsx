import { ConsequenceDialogue } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import type { AccountAction } from '../../../tools/account-action-state';
import { ACCOUNT_CONTROL } from '../../../tools/account-controls';

/**
 * UX-70 before a suspension or a removal (task 67.4; §5.2 A-08) — the account named, what ends, and
 * what is kept. Only the two consequence-disclosing controls reach it; removal says it cannot be undone.
 */
const CONFIRMED = {
  SUSPEND: 'suspend',
  REMOVE: 'remove',
} as const;

export function AccountConfirmation({
  action,
  busy,
  onConfirm,
  onCancel,
}: {
  readonly action: AccountAction | null;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations('platform.accounts.confirm');
  const wording = action?.control === ACCOUNT_CONTROL.REMOVE ? CONFIRMED.REMOVE : CONFIRMED.SUSPEND;

  return (
    <ConsequenceDialogue
      open={action !== null}
      object={action?.email}
      title={t(`${wording}.title`)}
      consequence={t(`${wording}.consequence`)}
      retained={t(`${wording}.retained`)}
      confirmLabel={t(`${wording}.confirm`)}
      cancelLabel={t('cancel')}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
