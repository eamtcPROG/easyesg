import { type Page } from '@playwright/test';

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
  await page.getByRole('button', { name: `Contul dumneavoastră: ${email}` }).click();
  await page.getByRole('menuitem', { name: 'Ieșiți din cont' }).click();
  await page.waitForURL('**/sign-in');
}
