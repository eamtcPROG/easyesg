import { getTranslations } from 'next-intl/server';
import { readActiveMembership } from '@/server/memberships';
import styles from '../styles/home.module.css';

/**
 * S-05's heading: the organization the reader is acting for, and the role they hold in it.
 *
 * **`hgroup`, not `header`** (11 Sep 2026, project owner). The two are not interchangeable and this
 * content is the second one's: `header` represents *"a group of introductory or navigational
 * aids"* — a logo, a search box, an action beside a title — while `hgroup` is defined as a heading
 * plus one or more `p` elements carrying *"a subheading, alternative title, or tagline"*, and only
 * the heading contributes to the document outline. An organization's name with the reader's role
 * beneath it is a title and its tagline exactly.
 *
 * **The duplicate-banner worry is not the reason, and saying so matters.** HTML-AAM lists `main`
 * among the ancestors that suppress `header`'s `banner` role, and `(workspace)`'s layout relies on
 * that deliberately — so the old element was no second landmark. It was worse than wrong in an
 * interesting way: bare, inside `main`, it mapped to `role="generic"` and carried no class, so it
 * asserted a semantic it did not have and did nothing at all.
 *
 * Four siblings shared the shape and changed with it; the screens whose heading sits beside a
 * **control** — S-06, S-13, S-14 — keep `header`, which is what that element is for.
 *
 * **The heading names the organization, not the reader** (task 30.5, unchanged): the artboard's
 * *"Good afternoon, Ana"* needs a display name registration does not collect (OQ-16, open) and a
 * time of day this Server Component cannot know for the reader.
 *
 * **The active membership comes from `readActiveMembership()` and is never re-derived here.** The
 * page used to compute `memberships?.find((m) => m.active)` inline *while also* awaiting
 * `readActiveMembership()` in the same `Promise.all` — one value, two spellings, and the inline one
 * is exactly what `server/memberships.ts` refuses: *"a second answer derived here … would be right
 * until the day someone holds two, and wrong invisibly."* Splitting the region out is what made the
 * duplicate visible.
 *
 * **It has a boundary, and the fallback never renders.** This paragraph read *"not behind a Suspense
 * boundary"* until task 125's fourth pass wrapped it — the sentence survived the change it described
 * and was wrong for one commit, which is what a docblock stating a *fact about its caller* costs.
 * The reason it was written still holds and is now the reason the fallback is inert: this read is
 * React-`cache()`d and `GlobalTier` awaits the same promise **outside any boundary** in the `(app)`
 * layout, so the shell cannot flush before this content exists and React inlines it.
 * `heading-loading.tsx` carries the state UX-90 requires either way, and `e2e/web/home.spec.ts`
 * asserts it: the `hgroup` this function returns is in the shell ahead of the overview's fallback,
 * and exactly one boundary was pending when that shell flushed. **Both of those replaced checks that
 * could not fail here** (task 126) — the old one located the organization's *name*, whose first
 * occurrence is `GlobalTier`'s plate in the band 3,280 bytes earlier, so it measured the layout and
 * would have stayed green with this region streaming.
 */
export async function OrganizationHeading() {
  const [active, t, tRoles] = await Promise.all([
    readActiveMembership(),
    getTranslations('organization.home'),
    getTranslations('organization.access.roles'),
  ]);

  return (
    <hgroup>
      <h1 className={`t-heading-1 ${styles.title}`}>
        {active ? active.organizationName : t('title')}
      </h1>
      <p className={`t-body ${styles.lede}`}>{active ? tRoles(active.role) : t('lede')}</p>
    </hgroup>
  );
}
