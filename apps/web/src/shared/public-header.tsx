import { BUTTON_TONE, BrandMark, Button, GlobalBar } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { Suspense } from 'react';
import { LocaleChoice } from './locale-choice';
import { LocaleChoiceMenu } from './locale-choice-menu';
import { PublicDrawer } from './public-drawer';
import { PublicDrawerMenu } from './public-drawer-menu';
import styles from './public-header.module.css';

/**
 * The `(public)` chrome — task 74.1's header half, on every screen in §5.1b's public tier.
 *
 * **`GlobalBar` rather than a second band, and that is a UX-89 reading rather than a shortcut.**
 * §11.5's Navigation row enumerates *Global bar* and no other band, and the component's own
 * documented empty state — `organization` absent, "brand and account corner, no plate" — is
 * exactly this rendering. UX-89's test for "nothing fits" is a difference in **anatomy**, and
 * there is none here: brand at one end, actions at the other, one row. A `PublicHeader` component
 * beside it would be a second name for one anatomy, invented against a divergence that has not
 * happened — the section nav the prototype draws was considered with the sections it points at
 * (task 74.3) and not built, since S-29's controls name none (`public-drawer-menu.tsx` says why).
 *
 * **The two Client Components that read the query string sit under `<Suspense>`** (task 74.4). The
 * marketing home beneath this band is prerendered, and a static page refuses `useSearchParams`
 * outside a boundary; the fallback is each menu with no query, which is the address the page was
 * built for, so the prerendered markup carries the switcher and the drawer rather than a gap.
 *
 * **A Server Component, and unlike `GlobalTier` it reads nothing.** §5.1b: these screens carry no
 * session, and *"nothing on them may read or imply an active organization"* — which is what keeps
 * `web-public-is-a-leaf` enforceable rather than aspirational. So no `readSession`, no
 * `readActiveMembership`, and no `organization` prop; the band's empty state is not a fallback
 * here, it is the only state.
 *
 * **What it carries is what renders.** The prototype's header draws four more entries — *How it
 * works*, *The questions*, *Plans*, *Help centre* — of which the first three are S-29 sections
 * that do not exist and the fourth is a screen returning `null` until task 77.2. `GlobalTier`
 * closed this exact question for the authenticated band: a chrome entry leading to a blank page
 * teaches the reader that the product is broken rather than unfinished. OQ-10 is the other half of
 * the answer — a prototype is authoritative over *values*, never over scope.
 *
 * The language choice is here because **§5's S-29 Controls row lists it** (*"register; sign in;
 * language choice; routes to the help centre and the legal set"*) and the artboards do not draw
 * one. §5 governs content; the prototype governs values. On a surface whose entire chrome is this
 * band, it is also the only place a reader can change language at all.
 *
 * **`LocaleChoice` and `PublicDrawer` take nothing from here** (task 158): both are Client Components
 * that read `chrome` themselves, so this band resolves only the words it renders.
 */
export async function PublicHeader() {
  const t = await getTranslations('chrome');

  return (
    <GlobalBar
      label={t('publicHeader.label')}
      brand={
        // **Not prefetched** (task 74.4). The landing is the one prerendered page, and Next 16 prefetches a static page
        // in segments — some 200 KB here, its layout's segment carrying the message catalogue — of which the router left
        // the repeat requests unread, open for the life of the page. Measured from S-36, where `networkidle` then never
        // came. A reader on a help or legal page is not on their way to the landing, and it is a static page to fetch.
        <Link href={ROUTES.LANDING} prefetch={false} aria-label={t('brandHome')}>
          <BrandMark />
        </Link>
      }
      actions={
        <>
          <div className={styles.actions}>
            <Suspense fallback={<LocaleChoiceMenu query="" />}>
              <LocaleChoice />
            </Suspense>
            <Link className={styles.link} href={ROUTES.SIGN_IN}>
              {t('publicHeader.signIn')}
            </Link>
            {/* The screen's primary action is a navigation, so `asChild` over this app's
                locale-aware `Link` — the seam task 26.3 added to `Button` for S-03, for the same
                reason. `tone="band"` because `--accent` on `--globalbar-surface` is pine on pine. */}
            <Button asChild tone={BUTTON_TONE.BAND}>
              <Link href={ROUTES.REGISTER}>{t('publicHeader.register')}</Link>
            </Button>
          </div>
          {/* The 390 frame's own band: brand and a hamburger, the three above collapsed into it
              (task 109). One of the two regions is always `display: none`, so neither offers the
              same destination twice. */}
          <Suspense fallback={<PublicDrawerMenu query="" />}>
            <PublicDrawer />
          </Suspense>
        </>
      }
    />
  );
}
