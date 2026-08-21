import { Callout, TextLink } from '@easyesg/ui';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SetPasswordForm } from '@/features/identity/components/set-password-form';
import styles from '@/features/identity/components/identity-screens.module.css';
import { Link } from '@/i18n/navigation';

/**
 * S-02 — Set password · CA · UC-09 · Focus
 *
 * The landing surface of the emailed reset link (`/{locale}/set-password?token=…`, built by
 * the worker). FR-6: consuming the link invalidates every existing session — the form states
 * that before it happens (P5). A bare arrival (no token) is a broken or stripped link: the
 * explanation offers the request route, mirroring `/verify`'s two-surfaces-one-address split.
 */
type Props = {
  params: Promise<{ locale: import('@easyesg/i18n').Locale }>;
  searchParams: Promise<{ token?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'identity.setPassword' });
  return { title: t('title') };
}

export default async function SetPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('identity.setPassword');
  const { token } = await searchParams;

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      {token ? (
        <SetPasswordForm token={token} />
      ) : (
        <Callout
          intent="error"
          title={t('missingTitle')}
          action={
            <TextLink asChild>
              <Link href="/reset">{t('missingAction')}</Link>
            </TextLink>
          }
        >
          {t('missingBody')}
        </Callout>
      )}
    </>
  );
}
