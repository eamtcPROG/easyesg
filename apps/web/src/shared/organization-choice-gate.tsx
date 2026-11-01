import { getLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { awaitsOrganizationChoice } from '@/features/identity/shared/tools/post-sign-in';
import { redirect } from '@/i18n/navigation';
import { REQUESTED_PATH_HEADER } from '@/lib/requested-path';
import { needsOrganization } from '@/lib/route-access';
import { chooseOrganizationRoute } from '@/lib/routes';
import { readMemberships } from '@/server/data/memberships';

/**
 * S-37's gate on `(app)`'s organization-scoped groups, the workspace and the wizard (task 83.3;
 * `design_spec.md` S-37: *any screen that needs an active organization, requested in that same state*).
 *
 * **In `shared/` on one test: its readers are in more than one feature** — `(workspace)`'s and the wizard's
 * layouts, two sibling route groups neither of which can see the other, and since task 83's parent close the
 * permission arm of every organization-scoped screen, across five features.
 *
 * **It either lets the screen render or sends the reader to choose.** An account holding several memberships
 * and no choice resolves no organization, so every organization-scoped read beneath it is refused; this sends
 * the reader to S-37 instead of drawing those refusals, carrying the address asked for as `?return=`.
 *
 * **Asked in two places, because neither alone meets the state wherever it is met.**
 *
 * - **In the two layouts, as `OrganizationChoiceGate`**, outside every `Suspense` boundary, so a request in
 *   that state is answered `307` before the screen's first byte — `choose-organization.spec.ts` asserts the
 *   status, which a gate inside a boundary would answer `200` and redirect after the shell.
 * - **In each screen's permission arm, as `redirectToChoiceIfOwed`**, because a layout is not rendered again
 *   when a link inside its group is followed. A removal landing mid-session is met by the next screen's own
 *   read, refused, and the arm is what renders on every navigation — the same file's link journey, which a
 *   layout-only gate failed (task 83's parent close). There the redirect arrives in the stream.
 *
 * **What it reads.** The memberships are `readMemberships()`'s, which the global tier has already asked for
 * when the layout renders; a navigation that renders no layout asks once, and only from a refused screen. The
 * address is `proxy.ts`'s `REQUESTED_PATH_HEADER`, because a layout is given no pathname. Without the header
 * it would still send the reader to choose, but could neither leave the account's own screens alone nor
 * bring the reader back.
 *
 * **A failed membership read lets the screen render**, whose own reads then fail in words — S-35 is the
 * branch's answer to that at sign-in, and this gate is not the branch.
 */
export async function redirectToChoiceIfOwed(): Promise<void> {
  const [memberships, requested, locale] = await Promise.all([
    readMemberships(),
    headers().then((all) => all.get(REQUESTED_PATH_HEADER)),
    getLocale(),
  ]);
  if (memberships === null || !awaitsOrganizationChoice(memberships)) return;
  if (requested !== null && !needsOrganization(requested)) return;

  redirect({ href: chooseOrganizationRoute(requested), locale });
}

/** The layouts' form of the gate: rendered first, it renders nothing. */
export async function OrganizationChoiceGate() {
  await redirectToChoiceIfOwed();
  return null;
}
