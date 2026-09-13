import { type Page } from '@playwright/test';

/**
 * The name every browser journey registers under — `registerAndVerify` and its siblings all fill
 * *Ana* and *Popescu* on S-01, and the social journeys assert `name: 'Ana Popescu'` through the
 * provider stub, which task 139 seeds into `given_name` whole. So UX-137 derives the same display
 * name either way, and one constant serves both.
 */
export const REGISTERED_DISPLAY_NAME = 'Ana Popescu';

/**
 * The account corner's trigger, by its accessible name — **one copy, and it earned that the hard
 * way** (task 140).
 *
 * SC 2.5.3 *Label in Name* is Level A and inside NFR-75's WCAG 2.2 AA: the accessible name must
 * contain the visible label, so when task 140 made the display NAME the visible text the trigger
 * had to be named `<label>: <name>, <address>` rather than by the address alone. That string was
 * written out at **eight** sites across this directory; fixing the one being edited and leaving
 * seven took thirteen browser journeys down in one run, which is the root `CLAUDE.md`'s *"a rule is
 * applied where it holds, not where it was found"* with a bill attached.
 *
 * `label` is a parameter because the chrome is localized and `global-tier.spec.ts` drives the
 * Russian one; `displayName` is one because UX-137 falls the name back to the address for an
 * account that has none, and the accessible name then states the address once rather than twice.
 */
export function accountTrigger(
  page: Page,
  input: {
    readonly email: string;
    readonly displayName?: string | null;
    readonly label?: string;
  },
) {
  const { email, displayName = REGISTERED_DISPLAY_NAME, label = 'Contul dumneavoastră' } = input;
  const name =
    displayName && displayName !== email ? `${label}: ${displayName}, ${email}` : `${label}: ${email}`;
  return page.getByRole('button', { name });
}

/**
 * Leaving the session through the shipped control (task 112).
 *
 * **It became setup rather than an assertion the day the gate gained its second direction.** A
 * screen whose completion issues a session now refuses a caller who already holds one, so a
 * `page.goto('/sign-in')` from a signed-in browser lands on the reader's home and the form is never
 * rendered — which is what took five journeys down when task 112's guard first ran: four in
 * `credentials.spec.ts` and one in `accessibility.spec.ts`, each having reached the sign-in screen
 * by a route no reader takes.
 *
 * So the helper exists to make those journeys faithful rather than to make them pass: a person
 * re-presenting their password leaves first, and this is the control they leave by. §4.2 puts
 * sign-out behind the account corner on every authenticated screen, which is why it is **two**
 * interactions and not one — and why the caller must already be on an `(app)` screen.
 *
 * `session.spec.ts` reads through here too, so the deliverable has one copy: if the menu item moves
 * or is renamed, this times out and every journey that leaves a session says so together.
 */
export async function signOut(page: Page, email: string): Promise<void> {
  await accountTrigger(page, { email }).click();
  await page.getByRole('menuitem', { name: 'Ieșiți din cont' }).click();
  await page.waitForURL('**/sign-in');
}
