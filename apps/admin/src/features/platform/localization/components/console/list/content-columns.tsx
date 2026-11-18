import type { ContentItem } from '@easyesg/contracts';
import { COLUMN_SIZE, type DataTableColumn } from '@easyesg/ui';
import { LOCALES } from '@easyesg/i18n';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';
import { ROW_OPENS, RowActions } from '~/shared/row-actions';
import { itemTitle, blockOf } from '../../../tools/content-payload';
import { CONTENT_KIND_LABEL } from '../../../tools/content-kind-labels';
import { DraftChip } from '../shared/draft-chip';

const CONTENT_COLUMN = {
  ITEM: 'item',
  KIND: 'kind',
  IN_FORCE: 'in_force',
  DRAFT: 'draft',
  LOCALES: 'locales',
  ACTIONS: 'actions',
} as const;

type ContentColumn = (typeof CONTENT_COLUMN)[keyof typeof CONTENT_COLUMN];

/**
 * A-03's columns (task 67.5): the item by its Romanian title, its kind, the revision in force, its open draft, and the
 * locales it carries — what is live, and what a translator still has to write — with *Edit* last, the row's action.
 */
export function useContentColumns({
  onOpen,
}: {
  readonly onOpen: (item: ContentItem) => void;
}): readonly DataTableColumn<ContentItem, ContentColumn>[] {
  const t = useTranslations('platform.content.table');
  const tKinds = useTranslations('platform.content.kinds');
  const tLocales = useTranslations('platform.content.locales');

  return useMemo(
    () => [
      {
        key: CONTENT_COLUMN.ITEM,
        header: t('item'),
        size: COLUMN_SIZE.FILL,
        cell: (item: ContentItem) => (
          <span className="flex flex-col">
            <span className="t-body-strong">
              {itemTitle({ payload: item.draft?.payload ?? item.inForce?.payload ?? null, key: item.key })}
            </span>
            <span className="t-caption text-[var(--text-muted)]" translate="no">
              {item.key}
            </span>
          </span>
        ),
      },
      { key: CONTENT_COLUMN.KIND, header: t('kind'), cell: (item: ContentItem) => tKinds(CONTENT_KIND_LABEL[item.kind]) },
      {
        key: CONTENT_COLUMN.IN_FORCE,
        header: t('inForce'),
        cell: (item: ContentItem) =>
          item.inForce === null ? t('notPublished') : t('revision', { revision: item.inForce.revision }),
      },
      {
        key: CONTENT_COLUMN.DRAFT,
        header: t('draft'),
        cell: (item: ContentItem) => (item.draft === null ? t('noDraft') : <DraftChip state={item.draft.state} />),
      },
      {
        key: CONTENT_COLUMN.LOCALES,
        header: t('locales'),
        cell: (item: ContentItem) => {
          const payload = item.draft?.payload ?? item.inForce?.payload ?? null;
          const present = payload === null ? [] : LOCALES.filter((locale) => blockOf(payload, locale) !== null);
          return present.map((locale) => tLocales(locale)).join(', ');
        },
      },
      {
        key: CONTENT_COLUMN.ACTIONS,
        header: <span className="sr-only">{t('actions')}</span>,
        size: COLUMN_SIZE.FIT,
        cell: (item: ContentItem) => (
          <RowActions name={item.key} opens={ROW_OPENS.EDIT} onOpen={() => onOpen(item)} />
        ),
      },
    ],
    [t, tKinds, tLocales, onOpen],
  );
}
