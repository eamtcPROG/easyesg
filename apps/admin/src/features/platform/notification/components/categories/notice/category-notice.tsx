import { BUTTON_VARIANT, Button, CALLOUT_INTENT, ExpiringCallout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import { NOTIFICATION_CATEGORY_LABEL } from '~/features/platform/shared/notification-category-label';
import { CATEGORY_NOTICE, type CategoryNotice as Notice } from '../../../tools/category-action-state';

/**
 * A-17's *success with revert*, its *conflict* state and its refusals (task 67.10) — above the record inside its
 * dialogue while one is open, above the categories otherwise (task 170; the board decides which).
 * **The result offers the revert** (UX-123's last step), previewed and confirmed like the publication it undoes.
 * **The conflict is worded here, not by the api**, because what it must say is what the screen now shows: what is in
 * force, reloaded.
 *
 * **Every arm leaves after a while, or when closed** (`design_spec.md` §8.1, amended 28 Sep 2026 by the project
 * owner), through the reducer's `NOTICE_DISMISSED` — the board moves this one element between two parents, and a
 * hook's memory of a closed notice would not survive the remount. The revert leaves with its result and stays offered
 * in the record and the row's menu; a pointer or focus on it holds the notice while it is being reached for.
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
  const tChrome = useTranslations('chrome');
  if (notice === null) return null;

  switch (notice.kind) {
    case CATEGORY_NOTICE.DONE:
      return (
        <ExpiringCallout
          intent={CALLOUT_INTENT.SUCCESS}
          title={t('doneTitle')}
          action={
            <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={() => onRevert(notice)}>
              {t('revert')}
            </Button>
          }
          dismissLabel={tChrome('closeMessage')}
          onDismiss={onDismiss}
        >
          {t(`done.${notice.action.control}`, {
            category: tCategories(NOTIFICATION_CATEGORY_LABEL[notice.action.categoryKey]),
          })}
        </ExpiringCallout>
      );
    case CATEGORY_NOTICE.CHANGED:
      return (
        <ExpiringCallout
          intent={CALLOUT_INTENT.ATTENTION}
          title={t('changedTitle')}
          action={null}
          dismissLabel={tChrome('closeMessage')}
          onDismiss={onDismiss}
        >
          {t('changedBody', { category: tCategories(NOTIFICATION_CATEGORY_LABEL[notice.categoryKey]) })}
        </ExpiringCallout>
      );
    case CATEGORY_NOTICE.REFUSED:
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
