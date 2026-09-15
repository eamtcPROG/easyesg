import { SOCIAL_SIGN_IN_INTENT } from '@easyesg/contracts';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { SocialNoticeCallout } from '../../social/components/social-notice';
import { SocialProviders } from '../../social/components/social-providers';
import styles from '../../shared/styles/identity-screens.module.css';
import { RegisterForm } from './register-form';

/**
 * S-01's registration region: the address's three query parameters read, and the heading, the
 * provider callback's notice, the credential form and the provider choices drawn from them
 * (`section-reads-parts-render`; the page is a shell since task 157).
 *
 * `?notice=` is the provider callback's outcome report, which `SocialNoticeCallout` validates against
 * its closed vocabulary before anything renders. `?invitation=` and `?return=` are S-03's hand-off,
 * carried to the form — whose action sends the invitation to the API — and `?return=` to the provider
 * flow too, each path sanitising it where it is finally used.
 */
export async function RegisterSection({
  searchParams,
}: {
  readonly searchParams: Promise<{ notice?: string; invitation?: string; return?: string }>;
}) {
  const [t, { notice, invitation, return: returnTo }] = await Promise.all([
    getTranslations('identity.register'),
    searchParams,
  ]);

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <div className={styles.notice}>
        <SocialNoticeCallout notice={notice} />
      </div>
      <RegisterForm invitationToken={invitation} returnTo={returnTo} />
      {/* Streams behind the form (async-suspense-boundaries): the provider list is an API
          round trip, and S-01's credential form must not wait on it — with the api
          unreachable, the component renders null and password sign-in stands alone. */}
      <Suspense fallback={null}>
        <SocialProviders intent={SOCIAL_SIGN_IN_INTENT.REGISTER} returnTo={returnTo} />
      </Suspense>
    </>
  );
}
