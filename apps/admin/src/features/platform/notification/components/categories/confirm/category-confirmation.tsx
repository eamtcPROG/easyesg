import { CATEGORY_CONSEQUENCE, type CategoryConsequence } from '@easyesg/contracts';
import { ConsequenceDialogue } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { NOTIFICATION_CATEGORY_LABEL } from '~/features/platform/shared/notification-category-label';
import { CATEGORY_CONTROL, type CategoryAction } from '../../../tools/category-action-state';

/**
 * UX-123's scope disclosure and confirmation (task 67.10; FR-163, UX-65, UX-70) — the category named, and **one
 * sentence per consequence the api previewed**: the people whose choice to switch it off stops counting, that
 * recipients may now switch it off, a channel it stops travelling on, and a channel it starts on with the people who
 * stay switched off there (§12.5.6's task-67.10 row (2)). **The api computes them**, from the switch-offs it holds; the
 * console only words them, so what is disclosed is what the publication will do.
 *
 * The consequence renders inside one paragraph, so the sentences are joined rather than listed.
 */
export function CategoryConfirmation({
  confirming,
  busy,
  onConfirm,
  onCancel,
}: {
  readonly confirming: { readonly action: CategoryAction; readonly consequences: readonly CategoryConsequence[] } | null;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations('platform.notificationCategories.confirm');
  const tCategories = useTranslations('platform.notificationCategories.categories');
  const tChannels = useTranslations('platform.notificationCategories.channelPhrase');
  const name = confirming === null ? '' : tCategories(NOTIFICATION_CATEGORY_LABEL[confirming.action.categoryKey]);
  const reverting = confirming?.action.control === CATEGORY_CONTROL.REVERT;

  const sentence = (consequence: CategoryConsequence): string => {
    switch (consequence.kind) {
      case CATEGORY_CONSEQUENCE.SWITCH_OFFS_OVERRIDDEN:
        return t('consequences.switch_offs_overridden', { people: consequence.people ?? 0 });
      case CATEGORY_CONSEQUENCE.BECOMES_SWITCHABLE:
        return t('consequences.becomes_switchable');
      case CATEGORY_CONSEQUENCE.CHANNEL_REMOVED:
        return consequence.channel === undefined
          ? ''
          : t('consequences.channel_removed', { channel: tChannels(consequence.channel) });
      case CATEGORY_CONSEQUENCE.CHANNEL_ADDED:
        return consequence.channel === undefined
          ? ''
          : t('consequences.channel_added', {
              channel: tChannels(consequence.channel),
              stayingOff: consequence.stayingOff ?? 0,
            });
    }
  };

  const consequences = confirming?.consequences ?? [];

  return (
    <ConsequenceDialogue
      open={confirming !== null}
      object={name}
      title={reverting ? t('revert.title', { category: name }) : t('publish.title', { category: name })}
      consequence={consequences.length === 0 ? t('nothingChanges') : consequences.map(sentence).join(' ')}
      retained={t('retained')}
      confirmLabel={reverting ? t('revert.confirm') : t('publish.confirm')}
      cancelLabel={t('cancel')}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
