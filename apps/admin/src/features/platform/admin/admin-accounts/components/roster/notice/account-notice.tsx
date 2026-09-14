import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { RefusalCallout } from '~/realm/components/shared/refusal-callout';
import { ACCOUNT_NOTICE, type AccountNotice as Notice } from '../../../tools/account-action-state';

/**
 * A-08's *success* state and its refusals, announced in place above the table (task 67.4) — what was
 * done and to whom, or the api's sentence for why it was not. A done notice can be dismissed; a refusal
 * stays until the next action, which is when it stops being true.
 */
export function AccountNotice({
  notice,
  onDismiss,
}: {
  readonly notice: Notice | null;
  readonly onDismiss: () => void;
}) {
  const t = useTranslations('platform.accounts.notice');
  if (notice === null) return null;

  const dismiss = (
    <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={onDismiss}>
      {t('dismiss')}
    </Button>
  );

  switch (notice.kind) {
    case ACCOUNT_NOTICE.DONE:
      return (
        <Callout intent={CALLOUT_INTENT.SUCCESS} title={t('doneTitle')} action={dismiss}>
          {t(`done.${notice.action.control}`, { email: notice.action.email })}
        </Callout>
      );
    case ACCOUNT_NOTICE.INVITED:
      return (
        <Callout intent={CALLOUT_INTENT.SUCCESS} title={t('invitedTitle')} action={dismiss}>
          {t('invitedBody', { email: notice.email })}
        </Callout>
      );
    case ACCOUNT_NOTICE.REFUSED:
      return (
        <RefusalCallout failure={notice.failure} title={t('refusedTitle')} fallback={t('refusedBody')} />
      );
  }
}
