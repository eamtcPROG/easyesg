import { expect, type Page } from '@playwright/test';
import { TOTP, URI } from 'otpauth';
import { signOut } from './session';
import { readSymbol } from './symbol';

/**
 * Driving the second factor through the shipped screens — shared by `credentials.spec.ts` (which
 * asserts the journeys) and `accessibility.spec.ts` (which needs the enrolment offer on screen, and an
 * enrolled account to reach the step axe scans).
 *
 * **Extracted 27 Aug 2026**, when a review found the whole enrolment journey copy-pasted between
 * the two files, TOTP generator included. Two copies of one journey is not a tidiness problem: when
 * S-28's controls move, one file is updated and the other fails as an unrelated axe test with a
 * locator timeout, pointing at the accessibility scan rather than at the screen that changed. The
 * copy also carried none of the reasoning below.
 *
 * The Romanian labels are deliberate: RO is the source locale (`localePrefix: 'as-needed'` serves
 * it unprefixed), so these drive the same strings a Moldovan user sees, and a catalogue change that
 * breaks a label is meant to break these.
 */

/**
 * The credential these helpers are given, never one they assume.
 *
 * `PASSWORD` is the conventional value a suite registers with; the helpers still take it, because
 * the two suites had chosen different literals and a helper that hard-coded one would have silently
 * broken the other. Passed **in an object with the address** rather than as a second positional
 * string: two adjacent `string` parameters transpose without a compile error and answer a plausible
 * "wrong password" (root CLAUDE.md), which on a factor journey reads as the enrolment having failed.
 */
export const PASSWORD = 'Str0ng-Passphrase!';

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/**
 * The code an authenticator shows for a factor it enrolled from `uri` — RFC 6238 over every
 * parameter the URI carries, which is exactly what an authenticator does with a scanned symbol.
 *
 * **It takes the scanned URI rather than a secret, since task 143.** It used to rebuild the factor
 * from the printed secret and restate the rest — SHA-1, six digits, thirty seconds, and the issuer
 * `'EasyESG Admin'`, under a paragraph explaining that the tenant realm's factor really was named for
 * the admin realm. That paragraph was the defect's only record: the issuer is the name a phone shows
 * its owner once the symbol is scanned, and task 143 gave the tenant realm its own. Parsing restates
 * nothing, so nothing here can drift from the server.
 */
export function codeFor(uri: string): string {
  return URI.parse(uri).generate();
}

/** What S-28 offers at the first enrolment step, each read the way its reader reads it. */
export interface EnrolmentOffer {
  /** The key as the screen prints it, for typing. */
  readonly secret: string;
  /** The Key Uri as a camera reads it off the symbol — decoded from pixels, never from the DOM. */
  readonly uri: string;
}

/**
 * Begins enrolment through S-28's own controls, and answers with both paths into an authenticator.
 *
 * **The two must be one factor, and this is where that is asserted rather than assumed**: the scanned
 * URI's secret is the printed one, and it names this realm and this person. A symbol drawn from the
 * wrong value, a key printed from a different offer, or the admin realm's issuer on a tenant factor
 * each fail here, on the screen that caused them.
 */
export async function offerEnrolment(
  page: Page,
  { email, password }: Credentials,
): Promise<EnrolmentOffer> {
  await page.goto('/account/credentials');

  const section = page.getByRole('region', { name: 'Verificare în doi pași' });
  // The record's own re-authentication field, outside all three sections and shared by them.
  // **This used to need `.last()`**, because the password section rendered a second field under
  // the same label — the duplicate S-28 shipped with, and which this helper had been quietly
  // working around since 27 Aug 2026 rather than reporting. Now unambiguous, and deliberately
  // written so that a second field with this label breaks the suite instead of being tolerated.
  await page.getByLabel('Parola actuală').fill(password);
  await section.getByRole('button', { name: 'Activați verificarea în doi pași' }).click();

  await expect(section.getByText('Scanați sau introduceți acest cod')).toBeVisible();
  // Strict, not `.first()`: at this stage the key is the region's only `t-code`, and a second one is
  // a defect for this locator to fail on rather than to choose between.
  const secret = (await section.locator('.t-code').textContent()) ?? '';
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);

  const uri = await readSymbol(
    section.getByRole('img', { name: 'Cod QR pentru aplicația de autentificare' }),
  );
  const scanned = URI.parse(uri);
  expect(scanned).toBeInstanceOf(TOTP);
  expect(scanned.secret.base32).toBe(secret);
  // The name a phone files the factor under, and so the words its owner reads there.
  expect(scanned.issuer).toBe('EasyESG');
  expect(scanned.label).toBe(email);

  return { secret, uri };
}

export interface EnrolledFactor {
  /** The Key Uri the authenticator enrolled from — what `codeFor` generates against. */
  readonly uri: string;
  /** The ten recovery codes, shown exactly once. */
  readonly recovery: string[];
}

/**
 * Enrols a second factor on a signed-in account through S-28's own controls, and answers with what
 * the screen showed.
 *
 * It goes through the UI rather than seeding the database on purpose: the point of these suites is
 * that three tasks' code agrees, and a seeded `totp_credential` row would prove only that the
 * challenge reads a table.
 *
 * **It confirms with a code generated from the scanned symbol, not from the printed key** — task
 * 143's expected result, a phone authenticator enrolling by scanning S-28, as the journey rather than
 * a separate assertion. `offerEnrolment` has already held the printed key to the same factor.
 */
export async function enrolFactor(page: Page, credentials: Credentials): Promise<EnrolledFactor> {
  const { uri } = await offerEnrolment(page, credentials);

  const section = page.getByRole('region', { name: 'Verificare în doi pași' });
  await section.getByLabel('Codul din aplicație').fill(codeFor(uri));
  await section.getByRole('button', { name: 'Finalizați activarea' }).click();

  // The recovery codes, shown exactly once — with the warning BEFORE them (P5).
  await expect(section.getByText(/Vi le arătăm o singură dată/)).toBeVisible();
  const codes = section.locator('li.t-code');
  await expect(codes).toHaveCount(10);
  const recovery = await codes.allInnerTexts();
  await section.getByRole('button', { name: 'Le-am notat' }).click();

  return { uri, recovery };
}

/**
 * The password half of S-01, which for an enrolled account ends on the staged factor step.
 *
 * **It signs out first, and that is the journey rather than a workaround** (task 112). Every caller
 * arrives holding the session enrolment left behind, and a screen that issues a session now refuses
 * a caller who has one — so `goto('/sign-in')` from here used to render the form and now lands on
 * the reader's home. A person re-presenting their password leaves first; so does this.
 */
export async function presentPassword(
  page: Page,
  { email, password }: Credentials,
): Promise<void> {
  await signOut(page, email);
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
}
