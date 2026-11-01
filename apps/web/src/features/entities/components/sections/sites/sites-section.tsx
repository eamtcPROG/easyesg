'use client';

import { RecordSection } from '@easyesg/ui';
import { FormSelect, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import { COORDINATES, parseCoordinates } from '../../../tools/coordinates';
import { defaultCountry, type CountryOption } from '../../../tools/countries';
import { EMPTY_SITE, type EntityFields } from '../../../tools/entity-fields';
import { ENTITY_RECORD_MESSAGES } from '../../shared/entity-messages';
import { EditableRow } from '../shared/editable-row';
import { RemovedRow } from '../shared/removed-row';
import { RowList } from '../shared/row-list';
import { ROW_COLLECTION, useRemovableRows } from '../shared/use-removable-rows';

/**
 * The sites (FR-17): a whole-collection save, so the list is held and sent as it stands — a row removed stays on screen
 * with its undo until then (28 Sep 2026). The heading counts the sites the save will keep, as the artboard's *Sites · 1*.
 *
 * **A site is captured whole since task 180.1** (`design_spec.md` S-13's amendment of 30 Sep 2026): its name, address and
 * town, then its postal code, its country and its coordinates — the six facts B1 publishes for a site, and the
 * coordinates are what B5's biodiversity questions are decided from (BR-APP-3). A new site starts in the one country
 * the platform registers, where there is one. The coordinates are one field, typed as a map copies them, and a save is
 * refused while they are not a pair; `coordinates.ts` owns what a pair is.
 */
export function SitesSection({
  control,
  archived,
  countries,
}: {
  readonly control: Control<EntityFields>;
  readonly archived: boolean;
  readonly countries: readonly CountryOption[];
}) {
  const t = useTranslations(`${ENTITY_RECORD_MESSAGES}.sites`);
  const sites = useRemovableRows({
    control,
    name: ROW_COLLECTION.SITES,
    blank: { ...EMPTY_SITE, countryCode: defaultCountry(countries) },
  });
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
              <FormTextField
                control={control}
                name={`sites.${index}.postalCode`}
                label={t('postalCode')}
                disabled={archived}
              />
              <FormSelect
                control={control}
                name={`sites.${index}.countryCode`}
                label={t('country')}
                placeholder={t('countryPlaceholder')}
                disabled={archived}
                options={countries}
              />
              <FormTextField
                control={control}
                name={`sites.${index}.coordinates`}
                label={t('coordinates')}
                help={t('coordinatesHelp')}
                disabled={archived}
                rules={{
                  validate: (value) =>
                    parseCoordinates(value).kind !== COORDINATES.INVALID || t('coordinatesInvalid'),
                }}
              />
            </EditableRow>
          );
        })}
      </RowList>
    </RecordSection>
  );
}
