'use client';

import { RecordSection } from '@easyesg/ui';
import { FormTextField } from '@easyesg/ui/forms';
import { validateIdno, validateLei } from '@easyesg/validation';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import type { ProfileFields } from '../../tools/profile-fields';
import { PROFILE_MESSAGES } from '../shared/profile-messages';

/**
 * FR-16's identifiers — **IDNO primary, LEI optional** (OQ-18; DUNS, EU ID and PermID are not
 * modelled and this screen must not offer them).
 *
 * **The rules come from `@easyesg/validation`, not from a regular expression here** (§9.8). The same
 * functions the API re-validates with, which is the whole reason that package exists — a rule
 * restated as a client-side schema is a second source of truth, and this file would be where the two
 * drift.
 *
 * **They separate *shape* from *check digits* because the two have different resolutions**, and that
 * is what lets NFR-79's "what now" say *retype it* or *check you copied the right one* rather than
 * one unhelpful sentence. A single boolean would have collapsed both into "invalid".
 */
export function IdentifiersSection({ control }: { readonly control: Control<ProfileFields> }) {
  const t = useTranslations(PROFILE_MESSAGES);

  return (
    <RecordSection
      id="identifiers"
      heading={t('identifiers.heading')}
      description={t('identifiers.lede')}
    >
      <FormTextField
        control={control}
        name="idno"
        label={t('identifiers.idno')}
        help={t('identifiers.idnoHelp')}
        inputMode="numeric"
        rules={{
          // Shape only, because the thirteenth digit's algorithm is not published in the defining
          // instrument — `validateIdno` says so, and a check this screen invented would refuse real
          // registrations at the door.
          validate: (value: string) =>
            !value.trim() || validateIdno(value.trim()).shape || t('identifiers.idnoMalformed'),
        }}
      />
      <FormTextField
        control={control}
        name="lei"
        label={t('identifiers.lei')}
        help={t('identifiers.leiHelp')}
        rules={{
          // Two verdicts, two sentences: a wrong shape is retyped, disagreeing check digits mean the
          // reader copied the wrong identifier. One boolean would say neither.
          validate: (value: string) => {
            const trimmed = value.trim().toUpperCase();
            if (!trimmed) return true;
            const verdict = validateLei(trimmed);
            if (!verdict.shape) return t('identifiers.leiMalformed');
            return verdict.checkDigits === true || t('identifiers.leiCheckDigits');
          },
        }}
      />
    </RecordSection>
  );
}
