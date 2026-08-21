'use client';

import { LOCALES } from '@easyesg/i18n';
import { LanguageSwitcher } from '@easyesg/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * The Focus header's actions (IMPLEMENTATION_PLAN Phase 2: the language switcher lands here
 * because identity is the first surface that has one). The legal footer used to live here too
 * and now lives in `src/shared/site-footer.tsx` — it is shared with the public surfaces, and it
 * belongs on the server, which this file is not.
 *
 * Language is URL state (routing.ts), so switching is a `Link` to the same path in the other
 * locale — query string included, because a verification token must survive the switch
 * (UX-4: the address restores the state). The labels are each language's own name for itself,
 * from the catalogue: a reader who cannot read the current language must still find theirs.
 */
export function IdentityHeaderActions() {
  const t = useTranslations('chrome');
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.toString();
  const target = query ? `${pathname}?${query}` : pathname;

  const locales = LOCALES.map((code) => ({ code, label: t(`locales.${code}`) }));
  const current = locales.find((entry) => entry.code === locale) ?? locales[0];

  return (
    <>
      <Link href="/help">{t('helpCentre')}</Link>
      <LanguageSwitcher
        tone="header"
        label={t('language')}
        current={current}
        locales={locales}
        renderItem={(entry) => (
          <Link href={target} locale={entry.code}>
            {entry.label}
          </Link>
        )}
      />
    </>
  );
}

/**
 * The footer moved to `src/shared/site-footer.tsx` (21 Aug 2026): the public and help surfaces
 * carry the same one, and as a Server Component it computes the copyright year from the clock
 * once, rather than shipping a client component that would compute it on both sides.
 */
