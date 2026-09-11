import { Suspense } from 'react';
import { ArrivalNotice } from '@/features/organization/home/components/arrival-notice';
import { MembershipsSection } from '@/features/organization/home/components/memberships-section';
import { OrganizationHeading } from '@/features/organization/home/components/organization-heading';
import { OverviewLoading } from '@/features/organization/home/components/overview-loading';
import { OverviewSection } from '@/features/organization/home/components/overview-section';
import styles from '@/features/organization/home/components/home.module.css';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-05 — Home / organization overview · all actors · UC-16, UC-67 · Workspace
 *
 * At `/{locale}/home`, not `/{locale}`: the marketing home holds the locale root because it is the
 * SEO landing page and the only page §14.2 permits to be cached, and Next rejects two route groups
 * resolving to one path. If the host split the design set implies is later confirmed, `/home`
 * becomes `/` on the tenant host behind a redirect.
 *
 * **Task 32.4 splits UX-6's three regions, which is what task 30.5 deferred.** That task shipped
 * one explicitly-empty region because all three are report-derived and reports did not exist; they
 * do now, so *what needs my attention*, *where did I leave off* and *what is the state of
 * everything* are three regions in that order. The amendment is recorded on `design_spec.md`'s S-05.
 *
 * **This file is a shell and holds no reads** (11 Sep 2026, project owner: *it's messy; smaller file
 * components in their own folder, and Suspense for the same parallel fetching*). It was 320 lines
 * and the largest route file in the app — two screen-sized components and every region's copy,
 * against `apps/web/CLAUDE.md`'s *"`app/` — routes only, thin. No logic, no data access"*. The four
 * regions now sit in `features/organization/home/components/` beside `filing-list.tsx`, whose own
 * docblock had already argued the move for itself. **The feature is per screen** (tasks 122, 123): it serves
 * four of them, and everything under `home/` — this screen's rules as well as its components — is
 * reached by this route and no other.
 *
 * **Parallelism survives the split because composition is what provides it, not `Promise.all`.**
 * The four regions were one `await Promise.all([...])` in this file; they are now sibling async
 * Server Components, which React starts together in one render pass — `server-parallel-fetching`'s
 * worked example, and the reason no read got slower. What the split removed is the *coupling*: the
 * screen no longer blocks on its slowest read before drawing any of itself.
 *
 * **One Suspense boundary, and only the overview earns it.** Of the four regions, three read
 * memberships — React-`cache()`d, and already in flight for the global tier in the `(app)` layout,
 * so the page cannot paint ahead of them whatever this file does. The overview makes an HTTP call
 * (`GET /periods`) that nothing else on the screen makes, sits below the fold and defines no
 * layout, which is precisely where `async-suspense-boundaries` says the trade pays. Wrapping the
 * heading would buy nothing and cost the layout shift that rule's own "when NOT to use" list names
 * — the H1 is the organization's name.
 *
 * **This file resolves no strings at all.** `MESSAGES` survives for `generateMetadata` alone; the
 * fallback resolves its own sentence like every other region, which it may because what it awaits is
 * a catalogue the request has already read rather than anything over the wire (`overview-loading.tsx`
 * carries the distinction the earlier, blunter rule here got wrong).
 *
 * States (§8.1): ready · read-only (view-only membership) · loading (the overview's boundary) ·
 * empty — first use · partial (the two reads fail independently, each with its own message) ·
 * error — permission · error — recoverable.
 */
const MESSAGES = 'organization.home';

type Props = {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function HomePage({ params, searchParams }: Props) {
  // Sequential on purpose: `activateRequestLocale` pins the locale every region's own reads and
  // translators resolve against. Neither line touches the network — `searchParams` is the request's
  // own.
  await activateRequestLocale(params);
  const query = await searchParams;

  return (
    <div className={styles.screen}>
      <ArrivalNotice joined={query.joined} />
      <OrganizationHeading />
      <Suspense fallback={<OverviewLoading />}>
        <OverviewSection />
      </Suspense>
      <MembershipsSection />
    </div>
  );
}
