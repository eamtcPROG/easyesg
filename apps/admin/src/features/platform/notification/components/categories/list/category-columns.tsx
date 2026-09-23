import type { ConsoleCategory, NotificationCategoryKey } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, type DataTableColumn } from '@easyesg/ui';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { NOTIFICATION_CATEGORY_LABEL } from '~/features/platform/shared/notification-category-label';
import { CategoryChannelsText } from '../shared/category-channels-text';
import { ClassificationChip } from '../shared/classification-chip';

const CATEGORY_COLUMN = {
  CATEGORY: 'category',
  CHANNELS: 'channels',
  CLASSIFICATION: 'classification',
  SWITCH_OFFS: 'switch_offs',
  CHANGED: 'changed',
} as const;

type CategoryColumn = (typeof CATEGORY_COLUMN)[keyof typeof CATEGORY_COLUMN];

/**
 * A-17's columns (task 67.10; §5.2 A-17 as amended) — the category, where it travels, whether recipients may switch it
 * off, how many people did, and its last publication. **The switch-offs are read before a record is opened**: they are
 * who a classification change reaches, which is the consequence §5.2 asks this editor to disclose.
 *
 * Memoised on the translators, the formatter and `onOpen`, which the board keeps stable — `reactCompiler` is off.
 */
export function useCategoryColumns({
  onOpen,
}: {
  readonly onOpen: (category: NotificationCategoryKey) => void;
}): readonly DataTableColumn<ConsoleCategory, CategoryColumn>[] {
  const t = useTranslations('platform.notificationCategories.table');
  const tCategories = useTranslations('platform.notificationCategories.categories');
  const format = useFormatter();

  return useMemo(
    () => [
      {
        key: CATEGORY_COLUMN.CATEGORY,
        header: t('category'),
        cell: (row: ConsoleCategory) => (
          <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => onOpen(row.categoryKey)}>
            {tCategories(NOTIFICATION_CATEGORY_LABEL[row.categoryKey])}
          </Button>
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
    ],
    [t, tCategories, format, onOpen],
  );
}
