'use client';

import { LOCALES } from '@easyesg/i18n';
import { LanguageSwitcher } from '@easyesg/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import styles from './identity-screens.module.css';

/**
 * The Focus header's actions and the legal footer — chrome the identity screens share
 * (IMPLEMENTATION_PLAN Phase 2: the language switcher lands here because identity is the
 * first surface that has one).
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

export function IdentityFooter() {
  const t = useTranslations('chrome.footer');

  return (
    <>
      <span className={styles.footerNote}>{t('legalNote')}</span>
      <nav className={styles.footerLinks} aria-label={t('legalNav')}>
        <Link href="/legal/terms">{t('terms')}</Link>
        <Link href="/legal/privacy">{t('privacy')}</Link>
        <Link href="/legal/cookies">{t('cookies')}</Link>
      </nav>
    </>
  );
}
