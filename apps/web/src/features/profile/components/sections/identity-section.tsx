'use client';

import type { AccountProfile } from '@easyesg/contracts';
import { RecordSection, TextField } from '@easyesg/ui';
import { FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import type { ProfileFields } from '../../tools/profile-fields';
import { PROFILE_MESSAGES } from '../shared/profile-messages';
import styles from '../styles/profile.module.css';

/**
 * Who the person is (task 52.3; FR-9 as amended; UX-137): the two name parts, the name every surface shows, the
 * optional job title, the address they sign in with, and the optional phone number.
 *
 * **The shown name is the one the api derived for what is stored**, not a preview computed here: UX-137's rule lives in
 * the api's `display-name.ts`, and a second copy in the browser would be free to disagree with it. It changes once a
 * save lands, which is when every other surface changes too.
 *
 * **The address is shown and not a field** (§12.5.6's task-52.3 row (2)): it is how the person signs in, and a second
 * editable address would be one the platform writes to unconfirmed. **The phone's shape is the api's to judge** — a
 * number in international form is a rule, and a rule restated as a pattern here would be a second source of truth
 * (`apps/web/CLAUDE.md`); the refusal arrives as the api's own sentence.
 */
export function IdentitySection({
  control,
  profile,
}: {
  readonly control: Control<ProfileFields>;
  readonly profile: AccountProfile;
}) {
  const t = useTranslations(PROFILE_MESSAGES);

  return (
    <RecordSection id="identity" heading={t('identity.heading')} description={t('identity.lede')}>
      <FormTextField
        control={control}
        name="givenName"
        label={t('identity.givenName')}
        autoComplete="given-name"
        rules={{
          required: t('identity.givenNameRequired'),
          maxLength: { value: 100, message: t('identity.nameTooLong') },
        }}
      />
      <FormTextField
        control={control}
        name="familyName"
        label={t('identity.familyName')}
        autoComplete="family-name"
        rules={{
          required: t('identity.familyNameRequired'),
          maxLength: { value: 100, message: t('identity.nameTooLong') },
        }}
      />
      <p className={`t-caption ${styles.derived}`}>{t('identity.shownAs', { name: profile.displayName })}</p>
      <FormTextField
        control={control}
        name="jobTitle"
        label={t('identity.jobTitle')}
        help={t('identity.optional')}
        autoComplete="organization-title"
        rules={{ maxLength: { value: 100, message: t('identity.jobTitleTooLong') } }}
      />
      <TextField label={t('identity.email')} help={t('identity.emailHelp')} value={profile.email} readOnly type="email" />
      <FormTextField
        control={control}
        name="phone"
        type="tel"
        label={t('identity.phone')}
        help={t('identity.phoneHelp')}
        autoComplete="tel"
        inputMode="tel"
        rules={{ maxLength: { value: 32, message: t('identity.phoneTooLong') } }}
      />
    </RecordSection>
  );
}
