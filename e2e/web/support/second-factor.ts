import { expect, type Page } from '@playwright/test';

/**
 * Driving the second factor through the shipped screens — shared by `credentials.spec.ts` (which
 * asserts the journeys) and `accessibility.spec.ts` (which needs an enrolled account to reach the
 * step axe scans).
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
 * RFC 6238 against the secret the screen just showed — the same generator an authenticator runs.
 *
 * The issuer is the API's, and it is `'EasyESG Admin'` on the tenant realm too: `ManageTotp`
 * borrows `platform/admin/domain/totp.ts`'s primitive, which is a deliberate sharing of a
 * *mechanism* rather than of the realms' data (NFR-65). Stated here because the string looks like a
 * copy-paste slip and is not — and because it is precisely what a second copy of this helper would
 * get wrong.
 */
export function totp(secret: string, email: string): Promise<string> {
  return import('otpauth').then(({ TOTP, Secret }) =>
    new TOTP({
      issuer: 'EasyESG Admin',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    }).generate(),
  );
}

export interface EnrolledFactor {
  /** The secret an authenticator would have captured. */
  readonly secret: string;
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
 */
export async function enrolFactor(
  page: Page,
  { email, password }: Credentials,
): Promise<EnrolledFactor> {
  await page.goto('/account/credentials');

  const section = page.getByRole('region', { name: 'Verificare în doi pași' });
  // `.last()` because the password field is the record's, shared by all three sections, and the
  // password section renders one above this.
  await page.getByLabel('Parola actuală').last().fill(password);
  await section.getByRole('button', { name: 'Activați verificarea în doi pași' }).click();

  await expect(section.getByText('Scanați sau introduceți acest cod')).toBeVisible();
  const secret = (await section.locator('.t-code').first().textContent()) ?? '';
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);

  await section.getByLabel('Codul din aplicație').fill(await totp(secret, email));
  await section.getByRole('button', { name: 'Finalizați activarea' }).click();

  // The recovery codes, shown exactly once — with the warning BEFORE them (P5).
  await expect(section.getByText(/Vi le arătăm o singură dată/)).toBeVisible();
  const codes = section.locator('li.t-code');
  await expect(codes).toHaveCount(10);
  const recovery = await codes.allInnerTexts();
  await section.getByRole('button', { name: 'Le-am notat' }).click();

  return { secret, recovery };
}

/** The password half of S-01, which for an enrolled account ends on the staged factor step. */
export async function presentPassword(
  page: Page,
  { email, password }: Credentials,
): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
}
