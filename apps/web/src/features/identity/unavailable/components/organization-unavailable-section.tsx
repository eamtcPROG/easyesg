import { getTranslations } from 'next-intl/server';
import { Callout, CALLOUT_INTENT, FocusColumn, TextLink } from '@easyesg/ui';
import type { Locale } from 'next-intl';
import { redirect } from '@/i18n/navigation';
import { destinationForHeldSession } from '@/server/session/post-sign-in';
import { POST_SIGN_IN, targetLocale } from '../../shared/tools/post-sign-in';

/** S-35's namespace, declared once for the section, its loading state and the route's title. */
export const ORGANIZATION_UNAVAILABLE_MESSAGES = 'identity.organizationUnavailable' as const;

/**
 * S-35's one region (UC-16's failure path; cut out of the route by task 137, `shell-composes-only`): re-runs §4.3's
 * branch on the held session and **redirects wherever the person actually belongs**, drawing the notice only when the
 * membership read failed again. Retrying is reloading, which is why there is no button.
 *
 * **The held-session read**, so this and the global tier above it share one call to `/memberships` in a render pass.
 * **The catalogue after the redirect check, not before**: on the arm that redirects it is work nobody reads
 * (`async-defer-await`). `locale` is the one the shell set, which the redirect's target needs.
 */
export async function OrganizationUnavailableSection({ locale }: { readonly locale: Locale }) {
  const target = await destinationForHeldSession();
  if (target.href !== POST_SIGN_IN.ORGANIZATION_UNAVAILABLE) {
    redirect({ href: target.href, locale: targetLocale(target, locale) });
  }

  const t = await getTranslations(ORGANIZATION_UNAVAILABLE_MESSAGES);

  // `FocusColumn` since task 30.2: §4.4 lists S-35 as a Focus screen, and its header would be `(identity)`'s chrome
  // where this screen already has the tier's.
  return (
    <FocusColumn>
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={t('title')}
        action={<TextLink href={POST_SIGN_IN.ORGANIZATION_UNAVAILABLE}>{t('retry')}</TextLink>}
      >
        {t('body')}
      </Callout>
    </FocusColumn>
  );
}
