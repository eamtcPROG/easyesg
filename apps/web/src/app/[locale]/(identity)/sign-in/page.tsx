import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { SOCIAL_SIGN_IN_INTENT } from '@easyesg/contracts';
import { SignInForm } from '@/features/identity/components/sign-in-form';
import { SocialNoticeCallout } from '@/features/identity/components/social-notice';
import { SocialProviders } from '@/features/identity/components/social-providers';
import styles from '@/features/identity/components/identity-screens.module.css';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-01 — Sign in · CA · UC-01…05 · Focus
 *
 * Email and password (task 22), and — task 24 (D-6) — the enabled provider choices on the same
 * surface, per S-01's content list. UX-108 (Accessible Authentication, WCAG 2.2 3.3.8) binds:
 * no cognitive function test, password managers and paste work everywhere, and the provider
 * buttons are plain anchors that need no JavaScript.
 *
 * `?return=` is `proxy.ts`'s UX-38 hand-off — the screen the session gate turned away, to be
 * resumed after sign-in. It rides through the form to the action — and through the provider
 * flow's sealed transaction cookie — each path sanitizing it (it round-trips the browser, so it
 * is attacker-shapeable) before redirecting. `?notice=` is the provider callback's outcome
 * report, validated against a closed vocabulary before anything renders.
 *
 * `design_spec.md` §5 owns this screen's content, controls and states; prototypes in
 * `design/screens/` are the rendered reference — values extracted, markup never copied (OQ-10).
 */
type Props = {
  params: LocaleParams;
  searchParams: Promise<{ return?: string; notice?: string }>;
};

export const generateMetadata = localizedPageTitle('identity.signIn');

export default async function SignInPage({ params, searchParams }: Props) {
  await activateRequestLocale(params);
  const t = await getTranslations('identity.signIn');
  const { return: returnTo, notice } = await searchParams;

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
