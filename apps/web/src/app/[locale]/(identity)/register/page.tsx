import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { SOCIAL_SIGN_IN_INTENT } from '@easyesg/contracts';
import { RegisterForm } from '@/features/identity/components/register-form';
import { SocialNoticeCallout } from '@/features/identity/components/social-notice';
import { SocialProviders } from '@/features/identity/components/social-providers';
import styles from '@/features/identity/components/identity-screens.module.css';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-01 — Register · CA · UC-01…05 · Focus
 *
 * D-1: the founding user of a new organization is auto-granted Organization Administrator.
 * A person becomes a pure Reporting Contributor only by invitation (UC-60 → UC-15).
 *
 * Captures email + password per S-01's content list and the task-19 API, plus — task 24
 * (FR-2, D-6) — the provider registrations (UC-02) as one-click alternatives. `?notice=` is
 * the provider callback's outcome report; UC-05's alternate flow lands here with
 * `social-unknown-identity`, offering the registration a sign-in must never perform silently.
 * Exits to the S-02 challenge on success (§4.3), or straight to a session where the provider
 * asserted the address verified (UC-03's alternate).
 * `design_spec.md` §5 owns this screen's content, controls and states; the Identity prototype
 * is the rendered reference — values extracted, markup never copied (OQ-10).
 */
type Props = { params: LocaleParams; searchParams: Promise<{ notice?: string }> };

export const generateMetadata = localizedPageTitle('identity.register');

export default async function RegisterPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  const t = await getTranslations('identity.register');
  const { notice } = await searchParams;

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <div className={styles.notice}>
        <SocialNoticeCallout notice={notice} />
      </div>
      <RegisterForm />
      {/* Streams behind the form (async-suspense-boundaries): the provider list is an API
          round trip, and S-01's credential form must not wait on it — with the api
          unreachable, the component renders null and password sign-in stands alone. */}
      <Suspense fallback={null}>
        <SocialProviders intent={SOCIAL_SIGN_IN_INTENT.REGISTER} />
      </Suspense>
    </>
  );
}
