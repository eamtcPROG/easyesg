import type { ConsoleCategory } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, Panel } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { NOTIFICATION_CATEGORY_LABEL } from '~/features/platform/shared/notification-category-label';
import { anyEditable, editableControlsOf } from '../../../tools/category-behaviour';
import type { CategoryAction } from '../../../tools/category-action-state';
import { CategoryBehaviourForm } from './category-behaviour-form';
import { CategoryFacts } from './category-facts';
import { CategoryRevert } from './category-revert';
import { CategoryWording } from './category-wording';

/**
 * A-17's record (task 67.10) — §4.6's Record for one category: its facts, its behaviour editor or the sentence saying
 * code fixes it, the one-step revert, and its words in every language, read-only.
 *
 * **The form is keyed by the revision it was opened on**, A-18's reason: a publication, or a colleague's the api refused
 * this one over, remounts it with what is now in force rather than leaving an edited copy of values that are stale.
 */
export function CategoryRecord({
  category,
  busy,
  onPreview,
  onClose,
}: {
  readonly category: ConsoleCategory;
  readonly busy: boolean;
  readonly onPreview: (action: CategoryAction) => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.notificationCategories.record');
  const tCategories = useTranslations('platform.notificationCategories.categories');
  const name = tCategories(NOTIFICATION_CATEGORY_LABEL[category.categoryKey]);

  return (
    <aside aria-label={t('region', { category: name })}>
      <Panel className="flex flex-col gap-[var(--space-5)] p-[var(--space-5)]">
        <h2 className="t-heading-3">{name}</h2>

        <CategoryFacts category={category} />
        {category.inForce !== null && category.inForce.channels === null ? (
          <p className="t-body">{t('unreadableNote')}</p>
        ) : null}
        {anyEditable(editableControlsOf(category)) ? (
          <CategoryBehaviourForm
            key={`${category.categoryKey}:${String(category.inForce?.revision ?? 0)}`}
            category={category}
            busy={busy}
            onPreview={onPreview}
          />
        ) : (
          <p className="t-body">{t('fixed')}</p>
        )}
        <CategoryRevert category={category} busy={busy} onPreview={onPreview} />
        <CategoryWording wording={category.wording} />

        <div>
          <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      </Panel>
    </aside>
  );
}
