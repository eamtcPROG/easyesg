import { getTranslations } from 'next-intl/server';
import { readActiveMembership } from '@/server/data/memberships';
import { readSession } from '@/server/session/session';
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
 * **The heading names the reader again since task 140, and the organization moved to the tagline.**
 * Task 30.5 had inverted the artboard — *"Good afternoon, Ana"* over *"Brutăria Lina SRL · …"* —
 * for two reasons, and only one of them has expired. The expired one is OQ-16: registration
 * collects a given and a family name since task 139, so there **is** a name to greet, derived by
 * UX-137. The one that stands is that the organization must be visible (UX-2), which is why it is
 * the subheading rather than gone: the `hgroup` still carries both facts, in the artboard's order.
 *
 * **The salutation is a plain one, not a time-of-day one, and the reason is the clock alone.**
 * This Server Component cannot know the reader's local hour — the session carries a locale, not a
 * zone — so *"good afternoon"* would be a guess rendered as a fact to every reader in every zone.
 * That is the second half of **task 30.5's** condition, which its `design_spec.md` S-05 amendment
 * states; it is **not** a half of OQ-16, whose two questions are the register's name field and its
 * consent checkbox (the latter split out as OQ-24). Citing OQ-16 for the clock is the mistake OQ-23
 * and OQ-24 were both raised to undo, one register row at a time.
 *
 * **The name may be the address, and that is UX-137's fallback rather than a defect here.** An
 * account that predates task 139, or a provider sign-up whose assertion carried no name, is greeted
 * by its address because that is the only name the product has for it — the same fallback the
 * account menu and S-16 render, derived once on the API and never re-derived per surface.
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
 * and this one is not among the boundaries still pending inside `<main>` when that shell flushed —
 * the overview's and the membership list's (task 159). **Both of those replaced checks that
 * could not fail here** (task 126) — the old one located the organization's *name*, whose first
 * occurrence is `GlobalTier`'s plate in the band 3,280 bytes earlier, so it measured the layout and
 * would have stayed green with this region streaming.
 */
export async function OrganizationHeading() {
  // `readSession` is a fourth await rather than a prop: this region is a sibling of the other
  // three, not a child of the page, so there is nothing to thread it through. It costs no I/O —
  // the request's cookie store is already resolved and the payload is one AES-GCM open — which is
  // what keeps this region inlined into the shell rather than streaming behind its own fallback.
  const [session, active, t, tRoles] = await Promise.all([
    readSession(),
    readActiveMembership(),
    getTranslations('organization.home'),
    getTranslations('organization.access.roles'),
  ]);

  return (
    <hgroup>
      {/* The greeting is the heading whether or not an organization resolved: the reader is the
          one fact this screen always has, and S-35's caller reaches this component with `active`
          null. `session` is null only where the layout above has already redirected. */}
      <h1 className={`t-heading-1 ${styles.title}`}>
        {session ? t('greeting', { name: session.account.displayName }) : t('title')}
      </h1>
      <p className={`t-body ${styles.lede}`}>
        {active
          ? t('membership', { organization: active.organizationName, role: tRoles(active.role) })
          : t('lede')}
      </p>
    </hgroup>
  );
}
