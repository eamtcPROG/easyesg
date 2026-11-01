import { SOCIAL_SIGN_IN_INTENT } from '@easyesg/contracts';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { SocialNoticeCallout } from '../../social/components/social-notice';
import { SocialProviders } from '../../social/components/social-providers';
import styles from '../../shared/styles/identity-screens.module.css';
import { SignInForm } from './sign-in-form';

/**
 * S-01's sign-in region: the address's two query parameters read, and the heading, the provider
 * callback's notice and the credential form — with the provider choices inside its card — drawn from
 * them (`section-reads-parts-render`; the page is a shell since task 157).
 *
 * `?return=` is `proxy.ts`'s UX-38 hand-off, riding through the form to the action and through the
 * provider flow's sealed transaction cookie, each path sanitising it before redirecting. `?notice=`
 * is the provider callback's outcome report, validated against a closed vocabulary before anything
 * renders.
 */
export async function SignInSection({
  searchParams,
}: {
  readonly searchParams: Promise<{ return?: string; notice?: string }>;
}) {
  const [t, { return: returnTo, notice }] = await Promise.all([
    getTranslations('identity.signIn'),
    searchParams,
  ]);

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <div className={styles.notice}>
        <SocialNoticeCallout notice={notice} />
      </div>
      {/* The providers go INSIDE the form's card, below the rule, which is where the artboard
          draws them at all three widths (§5's S-01 Layout row, amended 4 Sep 2026) — so they are
          handed in as a slot rather than rendered as a sibling.

          Still streamed (async-suspense-boundaries): the provider list is an API round trip and
          S-01's credential form must not wait on it. Passing the boundary as an element keeps that
          true across the move — a Server Component cannot be imported by the Client Component that
          renders the card, but its already-rendered output can be handed to it. With the api
          unreachable the component renders null and password sign-in stands alone. */}
      <SignInForm
        returnTo={returnTo}
        providers={
          <Suspense fallback={null}>
            <SocialProviders intent={SOCIAL_SIGN_IN_INTENT.SIGN_IN} returnTo={returnTo} />
          </Suspense>
        }
      />
    </>
  );
}
