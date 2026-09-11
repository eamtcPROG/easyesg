'use client';

import { Button, BUTTON_VARIANT, RecordSection } from '@easyesg/ui';
import { FormSelect, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useFieldArray, type Control } from 'react-hook-form';
import { CONSOLIDATION_BASIS } from '../../tools/entities';
import { EMPTY_MEMBER, type EntityFields } from '../../tools/entity-fields';
import { ENTITY_RECORD_MESSAGES } from '../shared/entity-messages';
import styles from '../styles/entities.module.css';

/**
 * The reporting boundary (FR-19): the consolidation basis, null until stated, and the members a
 * consolidated boundary names. Setting `consolidated` with no member is refused by the API and not
 * pre-empted here — the refusal names the boundary, and a client-side guard would be a second copy
 * of a rule that can change.
 */
export function BoundarySection({
  control,
  archived,
}: {
  readonly control: Control<EntityFields>;
  readonly archived: boolean;
}) {
  const t = useTranslations(ENTITY_RECORD_MESSAGES);
  const members = useFieldArray({ control, name: 'consolidationMembers' });

  return (
    <RecordSection id="boundary" heading={t('boundary.heading')} description={t('boundary.lede')}>
      <FormSelect
        control={control}
        name="consolidationBasis"
        label={t('boundary.basis')}
        help={t('boundary.basisHelp')}
        placeholder={t('boundary.basisPlaceholder')}
        disabled={archived}
        options={Object.values(CONSOLIDATION_BASIS).map((basis) => ({
          value: basis,
          label: t(`boundary.options.${basis}`),
        }))}
      />

      {members.fields.map((field, index) => (
        <fieldset key={field.id} className={styles.rowGroup}>
          <legend className="t-label">{t('boundary.member', { position: index + 1 })}</legend>
          <FormTextField
            control={control}
            name={`consolidationMembers.${index}.name`}
            label={t('boundary.memberName')}
            disabled={archived}
            rules={{ required: t('boundary.memberNameRequired') }}
          />
          <FormTextField
            control={control}
            name={`consolidationMembers.${index}.idno`}
            label={t('boundary.memberIdno')}
            disabled={archived}
          />
          {archived ? null : (
            <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => members.remove(index)}>
              {t('boundary.removeMember')}
            </Button>
          )}
        </fieldset>
      ))}

      {archived ? null : (
        <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => members.append(EMPTY_MEMBER)}>
          {t('boundary.addMember')}
        </Button>
      )}
    </RecordSection>
  );
}
