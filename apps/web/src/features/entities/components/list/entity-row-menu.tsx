'use client';

import { ENTITY_STATUS } from '@easyesg/contracts';
import { OverflowMenu } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { PERIODS_FROM } from '@/lib/periods-from';
import { entityPeriodsRoute, entityRoute } from '@/lib/routes';
import type { EntityRow } from '../../tools/entities';
import { ENTITIES_MESSAGES } from '../shared/entity-messages';

/**
 * A row's ⋯ on S-13 (19 Oct 2026, project owner: a table's row actions are one menu; `design_spec.md` S-13's row) —
 * named for its entity, holding the record to **edit**, or to **view** where it is archived and takes no change (FR-20),
 * and **its periods** (S-14), which the row has said since 30 Sep 2026 because a reader may not know the periods cell is
 * a link. Both stay reachable outside the menu — the entity's name and its periods cell are links — so the menu is a
 * shortcut and never the only way (the overflow menu's own rule).
 */
export function EntityRowMenu({ row }: { readonly row: EntityRow }) {
  const t = useTranslations(`${ENTITIES_MESSAGES}.rowActions`);
  const router = useRouter();
  const edits = row.standing === ENTITY_STATUS.ACTIVE;
  return (
    <OverflowMenu
      label={t('menu', { name: row.name })}
      items={[
        { key: 'record', label: edits ? t('edit') : t('view'), onSelect: () => router.push(entityRoute(row.id)) },
        {
          key: 'periods',
          label: t('periods'),
          onSelect: () => router.push(entityPeriodsRoute(row.id, PERIODS_FROM.ENTITIES)),
        },
      ]}
    />
  );
}
