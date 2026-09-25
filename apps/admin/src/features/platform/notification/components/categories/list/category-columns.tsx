import type { ConsoleCategory, NotificationCategoryKey } from '@easyesg/contracts';
import { COLUMN_ALIGN, type DataTableColumn, type OverflowMenuItem } from '@easyesg/ui';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { NOTIFICATION_CATEGORY_LABEL } from '~/features/platform/shared/notification-category-label';
import { ROW_OPENS, RowActions } from '~/shared/row-actions';
import { anyEditable, editableControlsOf } from '../../../tools/category-behaviour';
import { CATEGORY_CONTROL, revertActionOf, type CategoryAction } from '../../../tools/category-action-state';
import { CategoryChannelsText } from '../shared/category-channels-text';
import { ClassificationChip } from '../shared/classification-chip';

const CATEGORY_COLUMN = {
  CATEGORY: 'category',
  CHANNELS: 'channels',
  CLASSIFICATION: 'classification',
  SWITCH_OFFS: 'switch_offs',
  CHANGED: 'changed',
  ACTIONS: 'actions',
} as const;

type CategoryColumn = (typeof CATEGORY_COLUMN)[keyof typeof CATEGORY_COLUMN];

/**
 * A-17's columns (task 67.10; §5.2 A-17 as amended) — the category, where it travels, whether recipients may switch it
 * off, how many people did, and its last publication. **The switch-offs are read before a record is opened**: they are
 * who a classification change reaches, which is the consequence §5.2 asks this editor to disclose.
 *
 * **The last column opens the record** (task 170; `design_spec.md` §5.2's preamble): *Editați* where any of the
 * category's controls is the operator's to change — `editableControlsOf`, the rule the record's form is drawn by — and
 * *Vedeți* where code fixes all of them. **Its ⋯ holds the one-step revert** where there is a behaviour to go back
 * to: `revertActionOf`, the function the record's revert and the result's are built by, handed to the board's
 * `onPreview`, so it is previewed and confirmed exactly as theirs are (UX-123). **The name is plain text**: until
 * task 170 it was the opener, a link-coloured button nothing else on the row explained.
 *
 * Memoised on the translators, the formatter, the two callbacks the board keeps stable and whether anything is in
 * flight — `reactCompiler` is off (AD-9).
 */
export function useCategoryColumns({
  busy,
  onOpen,
  onPreview,
}: {
  readonly busy: boolean;
  readonly onOpen: (category: NotificationCategoryKey) => void;
  readonly onPreview: (action: CategoryAction) => void;
}): readonly DataTableColumn<ConsoleCategory, CategoryColumn>[] {
  const t = useTranslations('platform.notificationCategories.table');
  const tMenu = useTranslations('platform.notificationCategories.menu');
  const tCategories = useTranslations('platform.notificationCategories.categories');
  const tChrome = useTranslations('chrome.rowActions');
  const format = useFormatter();

  return useMemo(
    () => [
      {
        key: CATEGORY_COLUMN.CATEGORY,
        header: t('category'),
        cell: (row: ConsoleCategory) => (
          <span className="t-body-strong">{tCategories(NOTIFICATION_CATEGORY_LABEL[row.categoryKey])}</span>
        ),
      },
      {
        key: CATEGORY_COLUMN.CHANNELS,
        header: t('channels'),
        cell: (row: ConsoleCategory) => <CategoryChannelsText inForce={row.inForce} />,
      },
      {
        key: CATEGORY_COLUMN.CLASSIFICATION,
        header: t('classification'),
        cell: (row: ConsoleCategory) =>
          row.inForce?.classification == null ? null : <ClassificationChip classification={row.inForce.classification} />,
      },
      {
        key: CATEGORY_COLUMN.SWITCH_OFFS,
        header: t('switchOffs'),
        cell: (row: ConsoleCategory) => t('people', { count: row.switchOffs.people }),
      },
      {
        key: CATEGORY_COLUMN.CHANGED,
        header: t('changed'),
        cell: (row: ConsoleCategory) =>
          row.inForce?.publishedAt == null ? t('neverChanged') : format.dateTime(row.inForce.publishedAt, 'stamp'),
      },
      {
        key: CATEGORY_COLUMN.ACTIONS,
        header: tChrome('header'),
        align: COLUMN_ALIGN.END,
        cell: (row: ConsoleCategory) => {
          const revert = revertActionOf(row);
          const items: readonly OverflowMenuItem[] =
            revert === null
              ? []
              : [
                  {
                    key: CATEGORY_CONTROL.REVERT,
                    label: tMenu('revert'),
                    disabled: busy,
                    onSelect: () => onPreview(revert),
                  },
                ];
          return (
            <RowActions
              name={tCategories(NOTIFICATION_CATEGORY_LABEL[row.categoryKey])}
              opens={anyEditable(editableControlsOf(row)) ? ROW_OPENS.EDIT : ROW_OPENS.VIEW}
              onOpen={() => onOpen(row.categoryKey)}
              items={items}
            />
          );
        },
      },
    ],
    [t, tMenu, tCategories, tChrome, format, busy, onOpen, onPreview],
  );
}
