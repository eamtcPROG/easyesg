import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import styles from './site-footer.module.css';
import { ROUTES } from '@/lib/routes';

/**
 * The legal footer — the copyright note and the three legal documents.
 *
 * Shared rather than per-screen: the identity screens carry it today, the public and help
 * surfaces carry the same one in Phase 10, and UX-89's rule is that a need met twice is an
 * addition to the inventory rather than a second copy. It lives in `src/shared/` — chrome that
 * belongs to no single feature — mirroring `apps/admin/src/shared/`. It cannot live in
 * `packages/ui`, which owns no text and no router, and both are the whole substance here.
 *
 * It renders the footer's CONTENT, not the `<footer>` element: the page archetype owns that
 * (`FocusShell` already emits one), so a shell can place this without nesting landmarks.
 *
 * **A Server Component, and that is the point of the rewrite.** The year was previously frozen
 * into the catalogue — `© 2026 …` in all three locales — which silently becomes wrong on
 * 1 January and needs a release to correct. Reading it from the clock is the fix, but reading it
 * in a Client Component would compute it twice, once per side, and a reader in Tokyo at 23:30
 * Chișinău on 31 December would hydrate a different year than the server rendered. Computed
 * here, it is rendered once and never reaches the browser bundle.
 *
 * **Chișinău's year, not the reader's**, which is NFR-34's own test applied to a small case: a
 * copyright notice is a legal statement by a Moldovan company, so a different timezone must not
 * change its answer. `i18n/request.ts` already pins `Europe/Chisinau`, and the formatter uses it.
 */
export async function SiteFooter() {
  const t = await getTranslations('chrome.footer');
  const format = await getFormatter();

  // Formatted through the named `year` format, never `getFullYear()` interpolated as a number —
  // see the format's own note: ICU would render a numeric 2026 as "2 026" in ro and ru.
  const year = format.dateTime(new Date(), 'year');

  return (
    <>
      <span className={styles.note}>{t('legalNote', { year })}</span>
      <nav className={styles.links} aria-label={t('legalNav')}>
        <Link href={ROUTES.LEGAL_TERMS}>{t('terms')}</Link>
        <Link href={ROUTES.LEGAL_PRIVACY}>{t('privacy')}</Link>
        <Link href={ROUTES.LEGAL_COOKIES}>{t('cookies')}</Link>
      </nav>
    </>
  );
}
