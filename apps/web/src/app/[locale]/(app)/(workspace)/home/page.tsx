import { Suspense } from 'react';
// Grouped by region rather than alphabetically, so each fallback sits beside the thing it stands
// in for — the folders below `components/` are this list, one per child rendered here.
import { ArrivalNotice } from '@/features/organization/home/components/arrival/arrival-notice';
import { HeadingLoading } from '@/features/organization/home/components/heading/heading-loading';
import { OrganizationHeading } from '@/features/organization/home/components/heading/organization-heading';
import { OverviewLoading } from '@/features/organization/home/components/overview/section/overview-loading';
import { OverviewSection } from '@/features/organization/home/components/overview/section/overview-section';
import { MembershipsLoading } from '@/features/organization/home/components/memberships/section/memberships-loading';
import { MembershipsSection } from '@/features/organization/home/components/memberships/section/memberships-section';
import styles from '@/features/organization/home/components/styles/home.module.css';
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
 * regions now sit under `features/organization/home/components/`, with `filing-list.tsx` — whose own
 * docblock had already argued the move for itself — beside the two regions that draw it. **The
 * feature is per screen** (tasks 122, 123): it serves four of them, and everything under `home/` —
 * this screen's rules as well as its components — is reached by this route and no other.
 *
 * **And `components/` is one folder per child rendered below** (task 126): `arrival/`, `heading/`,
 * `overview/`, `memberships/`. The four children of this `return` are four folders of the same
 * names in the same order, which is what keeps a screen's folder legible as it grows — task 122's per-screen
 * partition applied one level down and verified the same way, by asking whether any file serves two
 * of the groups.
 *
 * **One file did, and the rule the owner then gave is what settled where it goes:** *a directory
 * holds files or folders, never both.* `home.module.css` is read by all four regions, so it belongs
 * to none of them — and under that rule it cannot sit above them either. It is `styles/`, a fifth
 * leaf; `shared/` is a sixth, holding the `Panel`-and-`h2` anatomy two of the regions wear. The same
 * rule empties `home/`'s own root into `components/` and `tools/`, and splits the two regions that
 * have parts — `overview/` into `section/`, `regions/`, `states/` and `shared/`, and `memberships/`
 * into `section/`, `list/`, `states/` and `shared/`.
 * Every directory under `home/` now answers *files or folders?* with one of the two, and what
 * decides which leaf a file lands in is always the same question: how many of the siblings read it.
 *
 * **Parallelism survives the split because composition is what provides it, not `Promise.all`.**
 * The four regions were one `await Promise.all([...])` in this file; they are now sibling async
 * Server Components, which React starts together in one render pass — `server-parallel-fetching`'s
 * worked example, and the reason no read got slower. What the split removed is the *coupling*: the
 * screen no longer blocks on its slowest read before drawing any of itself.
 *
 * **Every region that reads has a boundary and a skeleton; two of them currently stream.**
 * The overview makes an HTTP call (`GET /periods`) nothing else on the screen makes, and its
 * fallback is emitted into the shell — measured in `e2e/web/home.spec.ts` against the served HTML. The
 * heading and the membership list read memberships, which is React-`cache()`d and awaited by
 * `GlobalTier` **outside any boundary** in the `(app)` layout, so the shell cannot flush before that
 * data is ready: the heading is inlined and its skeleton never appears, while the list — a section,
 * a list and a row per membership since task 128, each awaiting its own translators — is still
 * resolving when the shell goes out, and its skeleton does. The same spec counts the boundaries still
 * pending **inside this screen's `<main>`** (task 159), so a boundary in a layout above — the
 * support-access banner's is one — cannot answer for this screen. This paragraph said *exactly one*
 * until then, and that the spec would notice a layout's boundary; it did, as a failure about S-05.
 *
 * **They are here anyway, and the reason is UX-90 rather than optimism**: a region that can wait has
 * a `loading` state whether or not this composition lets it be seen, and an undefined state is a
 * defect rather than an omission. What that rule does not license is pretending the boundary buys
 * something today — hence the measurement, in both directions.
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
  // The one thing this file still does: pin the locale every region's reads and translators resolve
  // against. `searchParams` is handed on unawaited — the component that reads it awaits it, which is
  // the same rule the regions follow with `rows` and `membership`.
  await activateRequestLocale(params);

  return (
    <div className={styles.screen}>
      {/* No boundary: it awaits `searchParams` and a catalogue, neither of which is I/O, and it
          renders above the heading — a fallback here would push the H1 down after paint. */}
      <ArrivalNotice searchParams={searchParams} />
      <Suspense fallback={<HeadingLoading />}>
        <OrganizationHeading />
      </Suspense>
      <Suspense fallback={<OverviewLoading />}>
        <OverviewSection />
      </Suspense>
      <Suspense fallback={<MembershipsLoading />}>
        <MembershipsSection />
      </Suspense>
    </div>
  );
}
