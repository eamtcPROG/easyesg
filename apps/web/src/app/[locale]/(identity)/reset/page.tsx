import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RequestResetForm } from '@/features/identity/components/request-reset-form';
import styles from '@/features/identity/components/identity-screens.module.css';

/**
 * S-02 — Request password reset · CA · UC-08 · Focus
 *
 * Uniform responses regardless of whether the account exists (NFR-64), and the only lockout
 * release before Phase 8 (task 21) — S-01's locked state routes here on purpose.
 */
type Props = { params: Promise<{ locale: import('@easyesg/i18n').Locale }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'identity.resetRequest' });
  return { title: t('title') };
}

export default async function ResetPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('identity.resetRequest');

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <RequestResetForm />
    </>
  );
}
