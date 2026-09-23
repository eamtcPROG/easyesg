import type { ConsoleCategory } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useId } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { revertActionOf, type CategoryAction } from '../../../tools/category-action-state';

/**
 * UX-123's one-step revert (task 67.10) — the behaviour before the one in force, named before it is asked for, and
 * previewed like a publication once it is. **It is a publication of that behaviour**, so a second revert undoes the
 * first and nothing is erased. Absent where there is nothing to go back to.
 */
export function CategoryRevert({
  category,
  busy,
  onPreview,
}: {
  readonly category: ConsoleCategory;
  readonly busy: boolean;
  readonly onPreview: (action: CategoryAction) => void;
}) {
  const t = useTranslations('platform.notificationCategories');
  const format = useFormatter();
  const noteId = useId();
  const action = revertActionOf(category);
  if (action === null) return null;
  const previous = action.behaviour;

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <p id={noteId} className="t-caption text-[var(--text-body)]">
        {t('revert.note', {
          channels: format.list(
            previous.channels.map((channel) => t(`channels.${channel}`)),
            'enumeration',
          ),
          classification: t(`classification.${previous.classification}`),
        })}
      </p>
      <div>
        <Button
          type="button"
          variant={BUTTON_VARIANT.SECONDARY}
          disabled={busy}
          aria-describedby={noteId}
          onClick={() => onPreview(action)}
        >
          {t('revert.action')}
        </Button>
      </div>
    </div>
  );
}
