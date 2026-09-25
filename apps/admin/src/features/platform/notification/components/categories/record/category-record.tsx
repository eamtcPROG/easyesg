import type { ConsoleCategory } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, DIALOG_SIZE, Dialog } from '@easyesg/ui';
import type { ReactNode } from 'react';
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
 * **In a dialogue over the categories since task 170** (`design_spec.md` §5.2's preamble and A-17's row as amended),
 * where it was a panel beside the table. **The wide size**: it holds each channel's words in three languages, email
 * bodies included, beside their labels. The dialogue's title is the category's name; UX-123's disclosure opens over it.
 *
 * **The notice arrives as a slot**, rendered above the record: the board owns the publication state and decides where
 * its notice is drawn, and while the dialogue is open that is here — the page behind a modal dialogue is hidden from
 * assistive technology, so the result and its revert, drawn there, would be out of reach of what the operator just did.
 *
 * **The form is keyed by the revision it was opened on**, A-18's reason: a publication, or a colleague's the api refused
 * this one over, remounts it with what is now in force rather than leaving an edited copy of values that are stale.
 */
export function CategoryRecord({
  category,
  busy,
  notice,
  onPreview,
  onClose,
}: {
  readonly category: ConsoleCategory;
  readonly busy: boolean;
  readonly notice: ReactNode;
  readonly onPreview: (action: CategoryAction) => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.notificationCategories.record');
  const tCategories = useTranslations('platform.notificationCategories.categories');
  const tChrome = useTranslations('chrome.dialog');

  return (
    <Dialog
      open
      onClose={onClose}
      title={tCategories(NOTIFICATION_CATEGORY_LABEL[category.categoryKey])}
      closeLabel={tChrome('close')}
      size={DIALOG_SIZE.WIDE}
      footer={
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onClose}>
          {t('close')}
        </Button>
      }
    >
      {notice}
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
    </Dialog>
  );
}
