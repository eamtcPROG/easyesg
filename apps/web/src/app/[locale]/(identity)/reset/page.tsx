import { getTranslations } from 'next-intl/server';
import { RequestResetForm } from '@/features/identity/components/request-reset-form';
import styles from '@/features/identity/components/identity-screens.module.css';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-02 — Request password reset · CA · UC-08 · Focus
 *
 * Uniform responses regardless of whether the account exists (NFR-64), and the only lockout
 * release before Phase 8 (task 21) — S-01's locked state routes here on purpose.
 */
type Props = { params: LocaleParams };

export const generateMetadata = localizedPageTitle('identity.resetRequest');

export default async function ResetPasswordPage({ params }: Props) {
  await activateRequestLocale(params);
  const t = await getTranslations('identity.resetRequest');

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <RequestResetForm />
    </>
  );
}
