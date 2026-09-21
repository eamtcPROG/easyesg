import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { readOrganizationProfile } from '@/server/data/organization-profile';
import { TENANT_READ } from '@/server/data/tenant-read';
import { redirectToChoiceIfOwed } from '@/shared/organization-choice-gate';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { OrganizationProfileForm } from '../form/organization-profile-form';
import { PROFILE_MESSAGES } from '../shared/profile-messages';
import styles from '../styles/organization-profile.module.css';

/**
 * S-15's one region: the read and which of §8.1's arms applies (UC-50, UC-51; cut out of the route
 * by task 134's parent-close review). **The screen never computes the caller's role** —
 * `OrganizationController` carries `@RequiresRole(ORGANIZATION_ADMINISTRATOR)` at class level, so an
 * editor or a viewer is refused and this renders the permission state from that refusal. Country
 * and legal-form keys are resolved to words here, where the catalogue object can be indexed — see
 * `VocabularyOption`'s docblock for why a translator call cannot take these values.
 */
export async function ProfileSection() {
  const [read, t, messages] = await Promise.all([
    readOrganizationProfile(),
    getTranslations(PROFILE_MESSAGES),
    getMessages(),
  ]);

  let body: ReactNode;
  if (read.status === TENANT_READ.FORBIDDEN) {
    // A choice not made is S-37's to answer, and this arm renders on every navigation (the gate says why).
    await redirectToChoiceIfOwed();
    body = (
      <Callout
        intent={CALLOUT_INTENT.WARNING}
        title={t('error.permission.title')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.HOME}>{t('error.permission.action')}</Link>
          </TextLink>
        }
      >
        {t('error.permission.body')}
      </Callout>
    );
  } else if (read.status === TENANT_READ.UNREACHABLE) {
    body = (
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={t('error.unreachable.title')}
        action={t('error.unreachable.action')}
      >
        {t('error.unreachable.body')}
      </Callout>
    );
  } else {
    const countryLabels: Readonly<Record<string, string>> = messages.organization.countries;
    const formLabels: Readonly<Record<string, string>> = messages.organization.legalForms;
    const countries = read.countries.map((country) => ({
      value: country.countryCode,
      label: countryLabels[country.countryCode] ?? country.countryCode,
      legalForms: country.legalForms.map((form) => ({ value: form, label: formLabels[form] ?? form })),
    }));
    body = <OrganizationProfileForm organization={read.organization} countries={countries} />;
  }

  return (
    <div className={styles.screen}>
      {body}
      {read.status === TENANT_READ.READY ? null : (
        <p className={`t-caption ${styles.footnote}`}>{t('lede')}</p>
      )}
    </div>
  );
}
