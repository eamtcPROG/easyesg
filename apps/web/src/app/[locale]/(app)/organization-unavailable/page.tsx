import { getTranslations } from 'next-intl/server';
import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { redirect } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { POST_SIGN_IN } from '@/features/identity/post-sign-in';
import { resolvePostSignIn } from '@/server/post-sign-in';

/**
 * S-35 — Organization unavailable · CA · UC-16 (failure path) · Focus
 *
 * Added to `design_spec.md` §4.4 on 25 Aug 2026 with task 25.4, which is what UX-7 makes a new
 * screen: an amendment to the inventory, not a note. It exists because a signed-in person whose
 * membership list could not be read must be told so — landing them in an empty workspace would
 * imply they belong to no organization, which is a different fact with a different remedy (S-04).
 *
 * **Retrying is reloading, and that is why there is no button and no action.** This is a Server
 * Component, so it re-runs the branch on every render: if the API answers this time, it redirects
 * to wherever the person actually belongs and this screen is never seen again. `api-client` is
 * read-only by construction — it never rotates the session — which is precisely what makes calling
 * it from a Server Component safe (a cookie write here would throw).
 *
 * It cannot loop: reaching the render below means the read failed, and a successful read never
 * resolves to this route.
 *
 * Sign-out is deliberately absent from the screen: the `(app)` layout's account corner carries it
 * (task 22's interim strip, task 30.1's real global tier), and a second sign-out control here
 * would be the one-off UX-89 forbids.
 *
 * No membership count appears anywhere in the copy — not knowing one is the entire reason the
 * screen exists.
 */
export const generateMetadata = localizedPageTitle('identity.organizationUnavailable');

export default async function OrganizationUnavailablePage({ params }: { params: LocaleParams }) {
  // **These two awaits are sequential on purpose and must not be parallelised.**
  // `activateRequestLocale` calls `setRequestLocale`, and `api-client` resolves `getLocale()` to
  // put `Accept-Language` on every call — so hoisting the read into a `Promise.all` with this
  // would send the request before the locale exists and bring back problem text in the wrong
  // language. It looks like the waterfall `async-parallel` names; it is a data dependency.
  const locale = await activateRequestLocale(params);
  const target = await resolvePostSignIn();
  if (target.href !== POST_SIGN_IN.ORGANIZATION_UNAVAILABLE) {
    redirect({ href: target.href, locale: target.locale ?? locale });
  }

  // Awaited after the redirect check, not before it: on the arm that redirects, the catalogue is
  // work nobody reads (`async-defer-await`).
  const t = await getTranslations('identity.organizationUnavailable');

  return (
    <Callout
      intent={CALLOUT_INTENT.ERROR}
      title={t('title')}
      action={
        <TextLink href={POST_SIGN_IN.ORGANIZATION_UNAVAILABLE}>{t('retry')}</TextLink>
      }
    >
      {t('body')}
    </Callout>
  );
}
