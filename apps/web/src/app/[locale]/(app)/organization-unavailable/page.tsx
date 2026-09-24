import {
  ORGANIZATION_UNAVAILABLE_MESSAGES,
  OrganizationUnavailableSection,
} from '@/features/identity/unavailable/components/organization-unavailable-section';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';

/**
 * S-35 — Organization unavailable · CA · UC-16 (failure path) · Focus
 *
 * Added to `design_spec.md` §4.4 on 25 Aug 2026 with task 25.4, which is what UX-7 makes a new
 * screen: an amendment to the inventory, not a note. It exists because a signed-in person whose
 * membership list could not be read must be told so — landing them in an empty workspace would
 * imply they belong to no organization, which is a different fact with a different remedy (S-04).
 *
 * **Retrying is reloading, and that is why there is no button and no action.** This is a Server
 * Component, so it re-runs the branch on every render: if the API answers this time, it redirects
 * to wherever the person actually belongs and this screen is never seen again. `api-client` is
 * read-only by construction — it never rotates the session — which is precisely what makes calling
 * it from a Server Component safe (a cookie write here would throw).
 *
 * It cannot loop: reaching the render below means the read failed, and a successful read never
 * resolves to this route. **A read the api refused because the session has ended does not render it
 * either** (task 160): the branch answers sign-in for that, so this page redirects there — the screen's
 * first sentence says sign-in succeeded, which for that reader is no longer true.
 *
 * Sign-out is deliberately absent from the screen: the `(app)` layout's account corner carries it
 * (task 22's interim strip, task 30.1's real global tier), and a second sign-out control here
 * would be the one-off UX-89 forbids.
 *
 * No membership count appears anywhere in the copy — not knowing one is the entire reason the
 * screen exists.
 *
 * **A shell since task 137** (`shell-composes-only`): it pins the locale and renders the section, which re-runs the
 * branch and redirects or draws (`features/identity/unavailable/components/organization-unavailable-section.tsx`);
 * `loading.tsx` beside it waits for that read.
 */
export const generateMetadata = localizedPageTitle(ORGANIZATION_UNAVAILABLE_MESSAGES);

export default async function OrganizationUnavailablePage({ params }: { params: LocaleParams }) {
  // **The locale first, and the section's read after it, on purpose**: `api-client` resolves `getLocale()` to put
  // `Accept-Language` on every call, so the read must not be hoisted beside this. It looks like the waterfall
  // `async-parallel` names; it is a data dependency.
  const locale = await activateRequestLocale(params);
  return <OrganizationUnavailableSection locale={locale} />;
}
