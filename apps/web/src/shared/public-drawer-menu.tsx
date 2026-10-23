'use client';

import { BrandMark, ChromeDrawer } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { useLocaleNames } from './use-locale-names';
import styles from './workspace-drawer.module.css';

/**
 * The `(public)` chrome at `compact` (task 109).
 *
 * **`EasyESG Public Home.dc.html`'s 390 frame is brand + hamburger and nothing else** — the band
 * carries no language, no sign-in and no call to action at that width, because the hero below it
 * carries *Start your report* and *Sign in* as content. So this is the design's own answer to the
 * band, not a smaller version of it.
 *
 * **It supersedes half of a recorded deferral, and only half.** `public-header.module.css` argued
 * that a menu "would collapse three items into a control that costs a tap to reveal what currently
 * fits", assigning it to task 74.3 with the section nav. The prototype collapses them anyway, so
 * the header half is settled by the artboards. The other half, the **section nav** — the marketing
 * page's own headings — was considered at task 74.3 and not built: S-29's controls and §4.7's row
 * name no section nav, the prototype governs values rather than scope (OQ-10), and on the help and
 * legal screens it would lead off the page. `ChromeDrawer` renders no `nav` without items, so this
 * drawer is the block below the rule.
 *
 * **The cost the deferral named is real on the help and legal screens**, and worth stating: those
 * render, they are not the marketing home, and they have no hero to carry a sign-in. At `compact`
 * their sign-in now costs a tap. That is the design's trade at this frame rather than this file's,
 * and UX-76 is satisfied because nothing is unavailable — it moved.
 *
 * **The query arrives as a prop since task 74.4**, read by `PublicDrawer` beside this file, so a prerendered page can
 * render this menu as its `<Suspense>` fallback — `locale-choice-menu.tsx` says why.
 *
 * **Its words are its own** (task 158), read from `chrome` rather than passed down by
 * `PublicHeader`; the query is the one thing it is handed.
 */
export function PublicDrawerMenu({ query }: { readonly query: string }) {
  const t = useTranslations('chrome');
  const { locale, locales } = useLocaleNames();
  const pathname = usePathname();
  // The query travels with the switch, as it does in both other locale surfaces (UX-4).
  const target = query ? `${pathname}?${query}` : pathname;

  return (
    <ChromeDrawer
      label={t('drawer.label')}
      closeLabel={t('drawer.close')}
      // Named although no list is rendered today: the prop is what the section nav will be
      // announced as, and leaving it unset would make adding the list a two-place change.
      sectionsLabel={t('drawer.label')}
      brand={<BrandMark />}
      actions={
        <>
          <Link className={styles.action} href={ROUTES.REGISTER}>
            {t('publicHeader.register')}
          </Link>
          <Link className={styles.action} href={ROUTES.SIGN_IN}>
            {t('publicHeader.signIn')}
          </Link>
          <p className={styles.group}>{t('language')}</p>
          {locales.map((entry) => (
            <Link
              key={entry.code}
              className={styles.action}
              href={target}
              locale={entry.code}
              aria-current={entry.code === locale ? 'true' : undefined}
            >
              {entry.label}
            </Link>
          ))}
        </>
      }
    />
  );
}
