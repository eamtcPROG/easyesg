'use client';

import { BrandMark, ChromeDrawer } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
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
 * the header half is settled by the artboards; what remains task 74.3's is the **section nav** —
 * the marketing page's own headings, which is the list the hamburger exists to hold and which does
 * not exist while `/` is unbuilt. `ChromeDrawer` renders no `nav` without items, so this drawer is
 * the block below the rule and gains the list when the page above it has one.
 *
 * **The cost the deferral named is real on the help and legal screens**, and worth stating: those
 * render, they are not the marketing home, and they have no hero to carry a sign-in. At `compact`
 * their sign-in now costs a tap. That is the design's trade at this frame rather than this file's,
 * and UX-76 is satisfied because nothing is unavailable — it moved.
 *
 * **Its words are its own** (task 158), read from `chrome` rather than passed down by
 * `PublicHeader`, so the drawer takes no props at all.
 */
export function PublicDrawer() {
  const t = useTranslations('chrome');
  const { locale, locales } = useLocaleNames();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The query travels with the switch, as it does in both other locale surfaces (UX-4).
  const query = searchParams.toString();
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
