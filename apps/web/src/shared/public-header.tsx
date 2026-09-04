import { BUTTON_TONE, BrandMark, Button, GlobalBar } from '@easyesg/ui';
import { LOCALES } from '@easyesg/i18n';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { LocaleChoice } from './locale-choice';
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
 * happened yet — the section nav the prototype draws, which arrives with the sections it points at
 * (task 74.3).
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
 */
export async function PublicHeader() {
  const [t, locale] = await Promise.all([getTranslations('chrome'), getLocale()]);

  return (
    <GlobalBar
      label={t('publicHeader.label')}
      brand={
        <Link href={ROUTES.LANDING} aria-label={t('brandHome')}>
          <BrandMark />
        </Link>
      }
      actions={
        <div className={styles.actions}>
          <LocaleChoice
            label={t('language')}
            locale={locale}
            locales={LOCALES.map((code) => ({ code, label: t(`locales.${code}`) }))}
          />
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
      }
    />
  );
}
