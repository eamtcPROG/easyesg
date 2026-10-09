import { LOCALES, type Locale } from '@easyesg/i18n';
import { ARIA_CURRENT } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { reportPreviewRoute } from '@/lib/routes';
import { PREVIEW_MESSAGES } from '../shared/preview-messages';
import styles from '../styles/preview.module.css';

/**
 * The document's language (FR-52; 182/34): each of the three a link to this preview in it, the one shown marked. **The
 * choice is the address's** (UX-4), so a preview in English can be sent; the language is named in itself, as the
 * language switcher names it.
 */
export async function PreviewLanguage(props: { readonly reportId: string; readonly language: Locale }) {
  const [t, tLocales] = await Promise.all([getTranslations(PREVIEW_MESSAGES), getTranslations('chrome.locales')]);
  return (
    <nav aria-label={t('language')} className={styles.language}>
      <p className={styles.languageLabel} aria-hidden="true">
        {t('language')}
      </p>
      <ul className={styles.languages}>
        {LOCALES.map((locale) => (
          <li key={locale}>
            <Link
              className={styles.choice}
              href={reportPreviewRoute({ reportId: props.reportId, language: locale })}
              hrefLang={locale}
              lang={locale}
              aria-current={locale === props.language ? ARIA_CURRENT.PAGE : undefined}
            >
              {tLocales(locale)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
