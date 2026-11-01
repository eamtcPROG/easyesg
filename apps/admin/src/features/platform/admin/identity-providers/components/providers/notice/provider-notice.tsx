import { CALLOUT_INTENT, ExpiringCallout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import { PROVIDER_NOTICE, type ProviderNotice as Notice } from '../../../tools/provider-action-state';

/**
 * A-18's *success* state, its *conflict* state and its refusals (task 67.11) — above the record inside its dialogue
 * while one is open, above the providers otherwise (task 170; the board decides which). **The conflict is worded here,
 * not by the api**, because what it must say is what the screen now shows: the values in force, reloaded under the
 * notice.
 *
 * **Every arm leaves after a while, or when closed** (`design_spec.md` §8.1, amended 28 Sep 2026 by the project
 * owner) — each is what the last write was answered with — through the reducer's `NOTICE_DISMISSED`, because the board
 * moves this one element between two parents and a hook's memory of a closed notice would not survive the remount.
 */
export function ProviderNotice({
  notice,
  onDismiss,
}: {
  readonly notice: Notice | null;
  readonly onDismiss: () => void;
}) {
  const t = useTranslations('platform.identityProviders.notice');
  const tProviders = useTranslations('platform.identityProviders.providers');
  const tChrome = useTranslations('chrome');
  if (notice === null) return null;

  switch (notice.kind) {
    case PROVIDER_NOTICE.DONE:
      return (
        <ExpiringCallout
          intent={CALLOUT_INTENT.SUCCESS}
          title={t('doneTitle')}
          action={null}
          dismissLabel={tChrome('closeMessage')}
          onDismiss={onDismiss}
        >
          {t(`done.${notice.action.control}`, { provider: tProviders(notice.action.provider) })}
        </ExpiringCallout>
      );
    case PROVIDER_NOTICE.CHANGED:
      return (
        <ExpiringCallout
          intent={CALLOUT_INTENT.ATTENTION}
          title={t('changedTitle')}
          action={null}
          dismissLabel={tChrome('closeMessage')}
          onDismiss={onDismiss}
        >
          {t('changedBody', { provider: tProviders(notice.provider) })}
        </ExpiringCallout>
      );
    case PROVIDER_NOTICE.REFUSED:
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
