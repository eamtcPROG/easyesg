import { CALLOUT_INTENT, ExpiringCallout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import { ACCOUNT_NOTICE, type AccountNotice as Notice } from '../../../tools/account-action-state';

/**
 * A-08's *success* state and its refusals, announced in place (task 67.4) — what was done and to whom,
 * or the api's sentence for why it was not. **Where "in place" is moved with task 170**: above the
 * table, or inside the record's or the invitation form's dialogue while one covers the page — the board
 * decides which.
 *
 * **Every arm leaves after a while, or when closed** (`design_spec.md` §8.1, amended 28 Sep 2026 by the project
 * owner), a refusal as well as a success, through the reducer's `NOTICE_DISMISSED`. Not `useDismissible`: the board
 * moves this one element between three parents, each move a remount, and a hook's memory of a closed notice would not
 * survive it.
 */
export function AccountNotice({
  notice,
  onDismiss,
}: {
  readonly notice: Notice | null;
  readonly onDismiss: () => void;
}) {
  const t = useTranslations('platform.accounts.notice');
  const tChrome = useTranslations('chrome');
  if (notice === null) return null;

  switch (notice.kind) {
    case ACCOUNT_NOTICE.DONE:
      return (
        <ExpiringCallout
          intent={CALLOUT_INTENT.SUCCESS}
          title={t('doneTitle')}
          action={null}
          dismissLabel={tChrome('closeMessage')}
          onDismiss={onDismiss}
        >
          {t(`done.${notice.action.control}`, { email: notice.action.email })}
        </ExpiringCallout>
      );
    case ACCOUNT_NOTICE.INVITED:
      return (
        <ExpiringCallout
          intent={CALLOUT_INTENT.SUCCESS}
          title={t('invitedTitle')}
          action={null}
          dismissLabel={tChrome('closeMessage')}
          onDismiss={onDismiss}
        >
          {t('invitedBody', { email: notice.email })}
        </ExpiringCallout>
      );
    case ACCOUNT_NOTICE.REFUSED:
      return (
        <ExpiringRefusal
          failure={notice.failure}
          title={t('refusedTitle')}
          fallback={t('refusedBody')}
          onDismiss={onDismiss}
        />
      );
  }
}
