'use client';

import { RecordSection } from '@easyesg/ui';
import { FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import { EMPTY_SITE, type EntityFields } from '../../../tools/entity-fields';
import { ENTITY_RECORD_MESSAGES } from '../../shared/entity-messages';
import { EditableRow } from '../shared/editable-row';
import { RemovedRow } from '../shared/removed-row';
import { RowList } from '../shared/row-list';
import { ROW_COLLECTION, useRemovableRows } from '../shared/use-removable-rows';

/**
 * The sites (FR-17): a whole-collection save, so the list is held and sent as it stands — a row removed stays on screen
 * with its undo until then (28 Sep 2026). The heading counts the sites the save will keep, as the artboard's *Sites · 1*.
 */
export function SitesSection({
  control,
  archived,
}: {
  readonly control: Control<EntityFields>;
  readonly archived: boolean;
}) {
  const t = useTranslations(`${ENTITY_RECORD_MESSAGES}.sites`);
  const sites = useRemovableRows({ control, name: ROW_COLLECTION.SITES, blank: EMPTY_SITE });
  const kept = sites.entries.filter((entry) => !entry.removed).length;

  return (
    <RecordSection id="sites" heading={t('heading', { count: kept })} description={t('lede')}>
      <RowList
        count={sites.entries.length}
        empty={t('none')}
        addLabel={t('add')}
        addButton={sites.addButton}
        readOnly={archived}
        onAddAction={sites.add}
      >
        {sites.entries.map((entry, index) => {
          const site = entry.name.trim() || t('site', { position: index + 1 });

          return entry.removed ? (
            <RemovedRow
              key={entry.key}
              sentence={t('removed', { site })}
              onRestoreAction={() => sites.restoreAt(index)}
            />
          ) : (
            <EditableRow
              key={entry.key}
              name={site}
              removeLabel={t('remove', { site })}
              readOnly={archived}
              onRemoveAction={() => sites.removeAt(index)}
            >
              <FormTextField
                control={control}
                name={`sites.${index}.name`}
                label={t('name')}
                disabled={archived}
                rules={{ required: t('nameRequired') }}
              />
              <FormTextField
                control={control}
                name={`sites.${index}.addressLine1`}
                label={t('address')}
                disabled={archived}
              />
              <FormTextField
                control={control}
                name={`sites.${index}.locality`}
                label={t('locality')}
                disabled={archived}
              />
            </EditableRow>
          );
        })}
      </RowList>
    </RecordSection>
  );
}
