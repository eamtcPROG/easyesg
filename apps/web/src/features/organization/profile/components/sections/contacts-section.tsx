'use client';

import { RecordSection } from '@easyesg/ui';
import { FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import { EMAIL_SHAPE } from '@/lib/email-shape';
import type { ProfileFields } from '../../tools/profile-fields';
import { PROFILE_MESSAGES } from '../shared/profile-messages';

/**
 * How easyESG reaches the organization (FR-15). **Never printed on a report**: the contact a report names is each
 * company's, on S-13, since task 177 — so this section holds one contact, the platform's, and says whose it is.
 */
export function ContactsSection({ control }: { readonly control: Control<ProfileFields> }) {
  const t = useTranslations(PROFILE_MESSAGES);

  return (
    <RecordSection id="contacts" heading={t('contacts.heading')} description={t('contacts.lede')}>
      <FormTextField
        control={control}
        name="contactEmail"
        type="email"
        label={t('contacts.platformEmail')}
        help={t('contacts.platformEmailHelp')}
        autoComplete="email"
        inputMode="email"
        rules={{ pattern: { value: EMAIL_SHAPE, message: t('contacts.emailInvalid') } }}
      />
      <FormTextField
        control={control}
        name="contactPhone"
        type="tel"
        label={t('contacts.platformPhone')}
        autoComplete="tel"
        inputMode="tel"
        rules={{ maxLength: { value: 40, message: t('contacts.phoneTooLong') } }}
      />
    </RecordSection>
  );
}
