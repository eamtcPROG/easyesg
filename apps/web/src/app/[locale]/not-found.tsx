import { FocusColumn } from '@easyesg/ui';
import { AddressNotFound } from '@/shared/address-not-found';

/**
 * §8.1's `error — not found`, as the localized 404 (task 103).
 *
 * **Before this file existed, `apps/web` had no not-found boundary at all**, so an unknown address
 * rendered Next's built-in default: unstyled, outside the token cascade, in English only, in a
 * product whose three locales are separately authored (FR-63), and with no route back.
 *
 * **It renders outside every route group's layout**, which is a property of where the file sits
 * rather than a choice — a not-found boundary renders inside the layouts ABOVE its own segment, and
 * the group layouts are below `[locale]`. So there is no `GlobalTier`, no `PublicHeader` and no
 * `<main>`, which is why `FocusColumn` is here: §4.6 makes the centred column the Focus archetype's
 * fixed element and it emits the landmark this page would otherwise lack entirely.
 *
 * **`[...rest]` is what actually routes an unmatched path here**, and the two files are one
 * mechanism rather than a page and a spare. A nested not-found boundary fires only on an explicit
 * `notFound()` call; an address that simply matches no route falls past it to the framework's own
 * default, which is the very thing this file replaces.
 *
 * **Reaching it signed out depends on the segment, and that is the proxy's rule rather than
 * this file's.** `proxy.ts`'s closed-by-default gate runs BEFORE routing, so an unknown address
 * under an authenticated segment answers 307 to sign-in with a `?return=` and never reaches the
 * catch-all; only `route-access.ts`'s unauthenticated segments 404 without a session, and every
 * address does once one exists. Measured, not assumed: `/nonsense` → 307, `/register/nonsense`
 * → 404. An unrecognised *locale* is NOT a third route in — next-intl rewrites `/xx/home` to the
 * source locale, so `[locale]`'s own `hasLocale` refusal is unreachable under
 * `localePrefix: 'as-needed'`, which an earlier draft of this comment claimed the opposite of.
 *
 * No `generateMetadata`: Next does not collect metadata from a not-found boundary. The tab title
 * comes from the catch-all page, which is the only route in the pair Next treats as a page.
 *
 * **Its content is client-rendered, and that is Next's behaviour rather than this file's.** The
 * production HTML for a 404 carries an empty shell — `<div hidden><!--$--><!--/$--></div>` — with
 * the markup arriving in the Flight payload, so the page is blank with JavaScript disabled. It was
 * measured rather than assumed: replacing this component with a synchronous `<h1>` and rebuilding
 * produced the same empty shell, which rules out the `await`s in `AddressNotFound` as the cause.
 * Every other surface in this app server-renders, so do not read this one as the pattern — and do
 * not try to "fix" it by making the component synchronous, which is the change that was already
 * tried and measured.
 */
export default function NotFound() {
  return (
    <FocusColumn>
      <AddressNotFound />
    </FocusColumn>
  );
}
