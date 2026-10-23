import { MAIN_CONTENT_ID } from '@easyesg/ui';
import { MarketingAnswering } from '@/features/public/marketing/components/answering/marketing-answering';
import { MarketingClosing } from '@/features/public/marketing/components/closing/marketing-closing';
import { MarketingData } from '@/features/public/marketing/components/data/marketing-data';
import { MarketingFaq } from '@/features/public/marketing/components/faq/marketing-faq';
import { MarketingHero } from '@/features/public/marketing/components/hero/marketing-hero';
import { generateMarketingMetadata } from '@/features/public/marketing/components/metadata/marketing-metadata';
import { MarketingReasons } from '@/features/public/marketing/components/reasons/marketing-reasons';
import { MarketingSections } from '@/features/public/marketing/components/sections/marketing-sections';
import { MarketingSteps } from '@/features/public/marketing/components/steps/marketing-steps';
import { activateRequestLocale, type LocaleParams } from '@/i18n/page';

/**
 * S-29 — Marketing home · VI · UC-177 · Content (§4.6) — task 74.3.
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale, emits the page's one `<main>` — the `(public)`
 * layout renders none — and composes the bands in the order the page reads. Each band reads its own words.
 *
 * **Prerendered once per locale and revalidated hourly** (task 74.4; `architecture.md` §14.2, amended 23 Oct 2026). The
 * page reads nothing per request — no session, no organization, no store — so it is the one page §14.2 lets the
 * framework cache, and `e2e/web/static-rendering.spec.ts` proves it is and that nothing outside `(public)` is. The hour
 * is the footer's: its copyright year is read from the clock, and a page cached for good would carry last year's after
 * 1 January. Its words change with a release, which rebuilds it.
 *
 * **The same page for everyone, a signed-in member included** (182/120): no redirect on a session, since a page that
 * varied by session could not be cached, and the way into the workspace is the header's.
 *
 * **No pricing section** (task 74.6; 182/118): it waits for the plan catalogue's presentation copy (53.3) and the
 * content read path that serves it (task 76), and reads that copy when both exist. Until then no price and no plan
 * term is written into the page. Its states follow: S-29's one failure, *error — system*, is that read path being
 * unavailable, which degrades to this page without the section — the page as it is today.
 */
export const revalidate = 3600;

export const generateMetadata = generateMarketingMetadata;

export default async function MarketingHomePage({ params }: { params: LocaleParams }) {
  await activateRequestLocale(params);

  return (
    // The skip link's target (task 203.3): `tabIndex={-1}` is what lets it take focus.
    <main id={MAIN_CONTENT_ID} tabIndex={-1}>
      <MarketingHero />
      <MarketingReasons />
      <MarketingSteps />
      <MarketingSections />
      <MarketingAnswering />
      <MarketingFaq />
      <MarketingData />
      <MarketingClosing />
    </main>
  );
}
