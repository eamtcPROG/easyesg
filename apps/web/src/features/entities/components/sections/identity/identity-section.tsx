'use client';

import { RecordSection } from '@easyesg/ui';
import { FormSelect, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import type { NaceCodeMatch } from '@easyesg/contracts';
import { ENTITY_FIELD } from '@easyesg/validation';
import { ENTITY_FIELD_ANCHOR } from '@/lib/entity-field-route';
import type { EntityFields } from '../../../tools/entity-fields';
import { IDENTIFIER_FAULT, idnoFault, leiFault } from '../../../tools/identifiers';
import { ActivityPicker } from './activity-picker';
import { ENTITY_RECORD_MESSAGES } from '../../shared/entity-messages';
import styles from '../../styles/entities.module.css';

/**
 * The name, the legal form, the identifiers (FR-16) and the activity (FR-17) — the name and the form side by side where
 * the card has room, as the record artboard pairs its identity fields, the IDNO and the LEI beneath them the same way,
 * and the activity the row's full width. The activity list lives outside the form — see `tools/entity-record-state.ts`
 * — so this section reports a change rather than registering a field for it.
 *
 * **The identifiers are the entity's since task 175**, moved from S-15 with their rules: **IDNO primary, LEI optional**
 * (OQ-18), each judged by `@easyesg/validation` — the functions the API re-validates with, so the two verdicts cannot
 * drift (§9.8) — with *shape* and *check digits* kept apart because their resolutions differ: a wrong shape is
 * retyped, disagreeing check digits mean the wrong identifier was copied (`tools/identifiers.ts`, since task 188 for
 * the IDNO's check digit too). **The LEI is labelled with its expansion**,
 * never the bare abbreviation, which a Moldovan reader takes for the currency (S-15's rule, moved with the field).
 *
 * **The IDNO carries the anchor a finding on it leads to** (task 210): a report whose entity holds none is not ready to
 * file, and S-08's and S-11's link lands here, focus in the input (`use-field-landing.ts`).
 */
export function IdentitySection({
  control,
  legalForms,
  archived,
  codes,
  suggestions,
  onCodesChangeAction,
}: {
  readonly control: Control<EntityFields>;
  readonly legalForms: readonly { readonly value: string; readonly label: string }[];
  readonly archived: boolean;
  readonly codes: readonly NaceCodeMatch[];
  readonly suggestions: readonly NaceCodeMatch[];
  readonly onCodesChangeAction: (codes: readonly NaceCodeMatch[]) => void;
}) {
  const t = useTranslations(ENTITY_RECORD_MESSAGES);

  return (
    <RecordSection id="identity" heading={t('identity.heading')} description={t('identity.lede')}>
      <div className={styles.fieldPair}>
        <FormTextField
          control={control}
          name="name"
          label={t('identity.name')}
          help={t('identity.nameHelp')}
          disabled={archived}
          rules={{
            required: t('identity.nameRequired'),
            maxLength: { value: 200, message: t('identity.nameTooLong') },
          }}
        />
        <FormSelect
          control={control}
          name="legalForm"
          label={t('identity.legalForm')}
          placeholder={t('identity.legalFormPlaceholder')}
          disabled={archived}
          options={legalForms}
        />
      </div>
      <div className={styles.fieldPair}>
        <div id={ENTITY_FIELD_ANCHOR[ENTITY_FIELD.IDNO]}>
          <FormTextField
            control={control}
            name="idno"
            label={t('identity.idno')}
            help={t('identity.idnoHelp')}
            inputMode="numeric"
            disabled={archived}
            rules={{
              validate: (value: string) => {
                const fault = idnoFault(value);
                if (fault === null) return true;
                return fault === IDENTIFIER_FAULT.MALFORMED ? t('identity.idnoMalformed') : t('identity.idnoCheckDigits');
              },
            }}
          />
        </div>
        <FormTextField
          control={control}
          name="lei"
          label={t('identity.lei')}
          help={t('identity.leiHelp')}
          disabled={archived}
          rules={{
            validate: (value: string) => {
              const fault = leiFault(value);
              if (fault === null) return true;
              return fault === IDENTIFIER_FAULT.MALFORMED ? t('identity.leiMalformed') : t('identity.leiCheckDigits');
            },
          }}
        />
      </div>
      {archived ? null : <ActivityPicker chosen={codes} suggestions={suggestions} onChange={onCodesChangeAction} />}
    </RecordSection>
  );
}
