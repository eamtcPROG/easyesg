import { getTranslations } from 'next-intl/server';
import { readMemberships } from '@/server/data/memberships';
import { HomeRegion } from '../../shared/home-region';
import { MembershipsList } from '../list/memberships-list';
import { MembershipsUnreachable } from '../states/memberships-unreachable';
import { MEMBERSHIPS_MESSAGES } from '../shared/memberships-messages';
import { MembershipsSwitchNote } from './memberships-switch-note';

/**
 * UC-16's *view memberships* half (FR-12) — task 30.5, split into files by task 128.
 *
 * **The section reads; the parts render** — S-05's own rule, arrived at over two passes of the
 * owner's review of the overview (task 125) and applied here without re-deriving it. This file does
 * the two things no part can: make the read, and decide which of §8.1's arms the region is in.
 * Everything below it takes what was read.
 *
 * **It reads for itself rather than taking the list as a prop**, which is what makes it a sibling of
 * the heading rather than a child of a fetch: `readMemberships()` is React-`cache()`d, so the
 * heading, the global tier and this region share one HTTP call in the render pass. Threading the
 * array down from `page.tsx` would have re-created the single `Promise.all` task 115's split
 * removed.
 *
 * **It wears `HomeRegion` rather than building a `Panel` and an `h2`** (task 128). It was the fifth
 * copy of `` `t-heading-3 ${styles.regionHeading}` `` and the one the overview's split had left
 * behind; splitting this file would have written it a sixth time. The component moved up to
 * `components/shared/` and lost the `Overview` in its name, because the level of a region's heading
 * was never the overview's business — it follows from this screen having one `h1`.
 *
 * **It has a boundary, and its fallback renders.** This read *"not behind a Suspense boundary"* until
 * task 125's fourth pass added one, and outlived the fact by a commit; then *"whose fallback never
 * renders"* until task 159, having outlived task 128 the same way. The promise it awaits is already
 * in flight for the chrome above it, so the *data* is ready the moment the shell can flush — but since
 * task 128 this region is a section, a list and a row per membership, each awaiting its own
 * translators, and that subtree is still resolving when the shell goes out. `memberships-loading.tsx`,
 * beside this file because `page.tsx` pairs the two, is the skeleton the shell carries.
 *
 * **The spec pins that by counting pending boundaries, not by position** (task 126). The check that
 * used to stand here compared this region's heading to the filings — true whichever way this region
 * renders, because its read resolves before `GET /periods` returns either way. What distinguishes
 * inlined from streamed is how many boundaries were still pending when the shell flushed, which
 * React writes into the HTML as `<!--$?-->`; `e2e/web/home.spec.ts` requires two inside this screen's
 * `<main>` — the overview's and this one — so this region becoming inlined turns it red, and a
 * layout's boundary above cannot (task 159).
 *
 * States (§8.1): ready · error — recoverable (`states/`). There is no `empty`: §4.3's post-sign-in
 * branch sends a reader who belongs to nothing to S-04, so anyone who can see this screen holds at
 * least one membership by construction.
 */
export async function MembershipsSection() {
  // Independent, so they do not queue (`async-parallel`). The translator is for the heading alone —
  // every other string on this region is resolved by the part that renders it.
  const [memberships, t] = await Promise.all([
    readMemberships(),
    getTranslations(MEMBERSHIPS_MESSAGES),
  ]);

  return (
    <HomeRegion heading={t('heading')}>
      {memberships === null ? (
        <MembershipsUnreachable />
      ) : (
        <MembershipsList memberships={memberships} />
      )}
      {/* Outside the arm on purpose: a reader whose list failed still needs to be told where the
          acting happens, and arguably needs it more. */}
      <MembershipsSwitchNote />
    </HomeRegion>
  );
}
