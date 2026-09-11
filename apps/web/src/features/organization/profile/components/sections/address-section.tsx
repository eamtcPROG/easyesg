'use client';

import { RecordSection } from '@easyesg/ui';
import { FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import type { ProfileFields } from '../../tools/profile-fields';
import { PROFILE_MESSAGES } from '../shared/profile-messages';

/**
 * The registered address, as the register holds it (FR-15).
 *
 * **Four free-text fields and no structure beyond the `autoComplete` tokens.** The platform operates
 * across jurisdictions whose address shapes differ, and a form that imposed one would refuse a
 * correct entry somewhere; the tokens are what lets a browser fill it without this screen deciding
 * what a locality is.
 *
 * **Every rule here is a length, which is the line `apps/web/CLAUDE.md` draws.** Field-level UX
 * carrying no business meaning may live in the form; a business rule may not. These lengths are the
 * column widths, and the API refuses past them regardless — the message exists so the refusal
 * arrives before the round trip, not instead of it.
 *
 * `address.lineTooLong` is shared by both lines deliberately: one sentence, two fields, and the
 * summary links each occurrence to its own control (UX-111), so the reader is never left guessing
 * which line it meant.
 */
export function AddressSection({ control }: { readonly control: Control<ProfileFields> }) {
  const t = useTranslations(PROFILE_MESSAGES);

  return (
    <RecordSection
      id="registered-address"
      heading={t('address.heading')}
      description={t('address.lede')}
    >
      <FormTextField
        control={control}
        name="registeredAddressLine1"
        label={t('address.line1')}
        autoComplete="address-line1"
        rules={{ maxLength: { value: 200, message: t('address.lineTooLong') } }}
      />
      <FormTextField
        control={control}
        name="registeredAddressLine2"
        label={t('address.line2')}
        autoComplete="address-line2"
        rules={{ maxLength: { value: 200, message: t('address.lineTooLong') } }}
      />
      <FormTextField
        control={control}
        name="registeredLocality"
        label={t('address.locality')}
        autoComplete="address-level2"
        rules={{ maxLength: { value: 120, message: t('address.localityTooLong') } }}
      />
      <FormTextField
        control={control}
        name="registeredPostalCode"
        label={t('address.postalCode')}
        autoComplete="postal-code"
        rules={{ maxLength: { value: 20, message: t('address.postalCodeTooLong') } }}
      />
    </RecordSection>
  );
}
