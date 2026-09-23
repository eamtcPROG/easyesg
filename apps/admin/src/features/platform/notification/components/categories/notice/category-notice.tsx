import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { RefusalCallout } from '~/realm/components/shared/refusal-callout';
import { NOTIFICATION_CATEGORY_LABEL } from '~/features/platform/shared/notification-category-label';
import { CATEGORY_NOTICE, type CategoryNotice as Notice } from '../../../tools/category-action-state';

/**
 * A-17's *success with revert*, its *conflict* state and its refusals, announced above the categories (task 67.10).
 * **The result offers the revert** (UX-123's last step), previewed and confirmed like the publication it undoes; the
 * conflict and a refusal stay until the next proposal, which is when they stop being true. **The conflict is worded
 * here, not by the api**, because what it must say is what the screen now shows: what is in force, reloaded.
 */
export function CategoryNotice({
  notice,
  onDismiss,
  onRevert,
}: {
  readonly notice: Notice | null;
  readonly onDismiss: () => void;
  readonly onRevert: (notice: Extract<Notice, { kind: typeof CATEGORY_NOTICE.DONE }>) => void;
}) {
  const t = useTranslations('platform.notificationCategories.notice');
  const tCategories = useTranslations('platform.notificationCategories.categories');
  if (notice === null) return null;

  switch (notice.kind) {
    case CATEGORY_NOTICE.DONE:
      return (
        <Callout
          intent={CALLOUT_INTENT.SUCCESS}
          title={t('doneTitle')}
          action={
            <div className="flex flex-wrap gap-[var(--space-2)]">
              <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={() => onRevert(notice)}>
                {t('revert')}
              </Button>
              <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={onDismiss}>
                {t('dismiss')}
              </Button>
            </div>
          }
        >
          {t(`done.${notice.action.control}`, {
            category: tCategories(NOTIFICATION_CATEGORY_LABEL[notice.action.categoryKey]),
          })}
        </Callout>
      );
    case CATEGORY_NOTICE.CHANGED:
      return (
        <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('changedTitle')} action={null}>
          {t('changedBody', { category: tCategories(NOTIFICATION_CATEGORY_LABEL[notice.categoryKey]) })}
        </Callout>
      );
    case CATEGORY_NOTICE.REFUSED:
      return <RefusalCallout failure={notice.failure} title={t('refusedTitle')} fallback={t('refusedBody')} />;
  }
}
