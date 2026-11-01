import type { Locale } from '@easyesg/i18n';
import { SkipLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';

/**
 * UX-99's skip link (task 203.3), the first thing a keyboard reaches on every page, to the `<main>` each layout or
 * archetype marks with `MAIN_CONTENT_ID` — with its words, read here so `[locale]/layout.tsx` composes and resolves no
 * string (`shell-composes-only`).
 *
 * **A Server Component handed the locale**: the layout renders it outside `NextIntlClientProvider`, and the layout
 * already holds the request's locale, so the part asks for that catalogue rather than relying on the request's.
 */
export async function PageSkipLink({ locale }: { readonly locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'chrome' });
  return <SkipLink label={t('skipLink')} />;
}
