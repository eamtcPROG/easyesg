'use client';

import { Button, BUTTON_VARIANT, RecordSection } from '@easyesg/ui';
import { FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useFieldArray, type Control } from 'react-hook-form';
import { EMPTY_SITE, type EntityFields } from '../../tools/entity-fields';
import { ENTITY_RECORD_MESSAGES } from '../shared/entity-messages';
import styles from '../styles/entities.module.css';

/** The sites (FR-18): a whole-collection save, so the list is held and sent as it stands. */
export function SitesSection({
  control,
  archived,
}: {
  readonly control: Control<EntityFields>;
  readonly archived: boolean;
}) {
  const t = useTranslations(ENTITY_RECORD_MESSAGES);
  const sites = useFieldArray({ control, name: 'sites' });

  return (
    <RecordSection id="sites" heading={t('sites.heading')} description={t('sites.lede')}>
      {sites.fields.map((field, index) => (
        <fieldset key={field.id} className={styles.rowGroup}>
          <legend className="t-label">{t('sites.site', { position: index + 1 })}</legend>
          <FormTextField
            control={control}
            name={`sites.${index}.name`}
            label={t('sites.name')}
            disabled={archived}
            rules={{ required: t('sites.nameRequired') }}
          />
          <FormTextField
            control={control}
            name={`sites.${index}.addressLine1`}
            label={t('sites.address')}
            disabled={archived}
          />
          <FormTextField
            control={control}
            name={`sites.${index}.locality`}
            label={t('sites.locality')}
            disabled={archived}
          />
          {archived ? null : (
            <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => sites.remove(index)}>
              {t('sites.remove')}
            </Button>
          )}
        </fieldset>
      ))}

      {archived ? null : (
        <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => sites.append(EMPTY_SITE)}>
          {t('sites.add')}
        </Button>
      )}
    </RecordSection>
  );
}
