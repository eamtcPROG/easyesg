import { CALLOUT_INTENT, ExpiringCallout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import {
  LEGAL_CONTROLLER_NOTICE,
  type LegalControllerNotice as Notice,
} from '../../../tools/legal-controller-save-state';

/**
 * A-21's *success* state, its *conflict* state and its refusals (task 75), above the form. **The conflict is worded
 * here, not by the api**, because what it must say is what the screen now shows: the values in force, reloaded under
 * the notice. **Every arm leaves after a while, or when closed** (`design_spec.md` §8.1), through the reducer's
 * `NOTICE_DISMISSED`.
 */
export function LegalControllerNotice({
  notice,
  onDismiss,
}: {
  readonly notice: Notice | null;
  readonly onDismiss: () => void;
}) {
  const t = useTranslations('platform.legalController.notice');
  const tChrome = useTranslations('chrome');
  if (notice === null) return null;

  switch (notice.kind) {
    case LEGAL_CONTROLLER_NOTICE.DONE:
      return (
        <ExpiringCallout
          intent={CALLOUT_INTENT.SUCCESS}
          title={t('doneTitle')}
          action={null}
          dismissLabel={tChrome('closeMessage')}
          onDismiss={onDismiss}
        >
          {t('doneBody')}
        </ExpiringCallout>
      );
    case LEGAL_CONTROLLER_NOTICE.CHANGED:
      return (
        <ExpiringCallout
          intent={CALLOUT_INTENT.ATTENTION}
          title={t('changedTitle')}
          action={null}
          dismissLabel={tChrome('closeMessage')}
          onDismiss={onDismiss}
        >
          {t('changedBody')}
        </ExpiringCallout>
      );
    case LEGAL_CONTROLLER_NOTICE.REFUSED:
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
