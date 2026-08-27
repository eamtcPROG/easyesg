import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  issueInvitation,
  revokeInvitations,
  verificationTokenFor,
} from './support/db';

/**
 * S-03 in a real browser (UC-15, FR-11; task 26.3) — the deliverable stated as a journey: **a user
 * joins an organization from the browser, and expiry is a designed state rather than an error
 * page.**
 *
 * `invitation.spec.ts` in `apps/web` proves the branch as a function, arm by arm, with no API. This
 * proves the wiring — that the shipped screens read a real invitation through the real bearer
 * policy, hand off to S-01 and back, and end with a membership the api actually created.
 *
 * **The invitations are seeded, not issued through S-16**, because S-16 is task 26.4. The api's own
 * suite drives `POST /invitations` end to end; the subject here is the person who *receives* one.
 */
const RUN_PREFIX = `e2e-web-invite-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

/** An organization with an administrator, so an invitation has somewhere to point. */
async function anOrganization(label: string): Promise<{ id: string; name: string }> {
  const name = `${RUN_PREFIX}-${label}`;
  const id = await grantMembership({ email: addressFor(`${label}-oa`), organizationName: name });
  organizations.push(id);
  return { id, name };
}

async function registerAndVerify(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  await expect(page.getByText('Adresa este confirmată')).toBeVisible();
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
}

// ── The two entries S-03 has ────────────────────────────────────────────────────────────────────

/**
 * The signed-in entry: the invitee already has an account and is using it.
 *
 * The one journey that spends the invitation, so it also proves what only the api can do — the
 * membership exists afterwards, and the session is pointed at the organization just joined.
 */
test('an invited user with an account joins from the browser (UC-15)', async ({ page }) => {
  const organization = await anOrganization('joined');
  const email = addressFor('member');
  await registerAndVerify(page, email);
  await page.goto('/sign-in');
  await signIn(page, email);
  // A member of nothing lands on S-04 (§4.3's "none" arm, task 25.4) — which is the state this
  // journey exists to change.
  await page.waitForURL('**/create-organization');

  const token = await issueInvitation({ organizationId: organization.id, email });
  await page.goto(`/invitation/${token}`);

  // S-03's stated content, asserted **in the summary** rather than anywhere on the page: the
  // organization's name legitimately appears twice — once as a fact and once inside the sentence
  // the accept button explains itself with — so an unscoped locator is ambiguous by design.
  const summary = page.getByRole('definition');
  await expect(summary.filter({ hasText: organization.name })).toBeVisible();
  await expect(summary.filter({ hasText: 'Editare' })).toBeVisible();
  await expect(summary.filter({ hasText: email })).toBeVisible();

  await page.getByRole('button', { name: 'Acceptați invitația' }).click();

  // The exit S-03 promises: S-05 in the newly joined organization. The api pointed the session at
  // it inside the acceptance transaction, so there is nothing for the browser to switch.
  await page.waitForURL('**/home');
});

/**
 * The signed-out entry, and the whole hand-off: S-03 → S-01's registration carrying the invitation
 * → back to S-03 → accepted.
 *
 * **The assertion that matters is the one that does not happen: no verification screen.** The
 * account is created already verified because the registration carried the invitation (FR-3,
 * §12.5.6's task-26.2 row), so this journey never visits `/verify` and no second email is waited
 * for — which is the entire point of that amendment, and is invisible to any test that only checks
 * the end state.
 */
test('a signed-out invitee registers and joins with one email (FR-3, UC-15)', async ({ page }) => {
  const organization = await anOrganization('handoff');
  const email = addressFor('newcomer');
  const token = await issueInvitation({
    organizationId: organization.id,
    email,
    role: 'viewer',
  });

  await page.goto(`/invitation/${token}`);
  const summary = page.getByRole('definition');
  await expect(summary.filter({ hasText: organization.name })).toBeVisible();
  await expect(summary.filter({ hasText: 'Doar vizualizare' })).toBeVisible();

  await page.getByRole('link', { name: 'Creați un cont' }).click();
  await page.waitForURL('**/register**');

  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();

  // Straight to sign-in — NOT to the S-02 challenge, because there is no challenge to answer.
  await page.waitForURL('**/sign-in**');
  await signIn(page, email);

  // `?return=` brought them back to the invitation rather than to a generic home.
  await page.waitForURL(`**/invitation/${token}`);
  await page.getByRole('button', { name: 'Acceptați invitația' }).click();
  await page.waitForURL('**/home');
});

// ── The states that are designed, not error pages ───────────────────────────────────────────────

test('an expired invitation explains itself and names the way out', async ({ page }) => {
  const organization = await anOrganization('expired');
  const email = addressFor('late');
  const token = await issueInvitation({
    organizationId: organization.id,
    email,
    expiresAt: new Date(Date.now() - 60_000),
  });

  await page.goto(`/invitation/${token}`);

  await expect(page.getByText('Invitație expirată')).toBeVisible();
  // NFR-79's third part, and the reason the four standings are separate values: the resolving
  // action for an expired link is a resend, which is not what any of the other three would say.
  await expect(page.getByText(/retrimită/)).toBeVisible();
  // The details are withheld once the link stops working — an organization's name is its own fact.
  await expect(page.getByText(organization.name)).toBeHidden();
});

test('a revoked invitation says withdrawn, not expired', async ({ page }) => {
  const organization = await anOrganization('revoked');
  const email = addressFor('withdrawn');
  const token = await issueInvitation({ organizationId: organization.id, email });
  await revokeInvitations(organization.id, email);

  await page.goto(`/invitation/${token}`);

  await expect(page.getByText('Invitație anulată')).toBeVisible();
});

test('a link that names no invitation is its own sentence', async ({ page }) => {
  await page.goto(`/invitation/${'z'.repeat(43)}`);

  await expect(page.getByText('Link nerecunoscut')).toBeVisible();
});

/**
 * S-03's permission state — a forwarded link, or the second mailbox a bookkeeper uses.
 *
 * It names **both** addresses, because "this is not for you" is unactionable without saying which
 * of the reader's mailboxes it is for, and the way out is one control rather than a manual
 * sign-out-and-find-the-email-again.
 */
test('a session on another address is offered the way out (UC-15)', async ({ page }) => {
  const organization = await anOrganization('mismatch');
  const invited = addressFor('invited');
  const bystander = addressFor('bystander');

  await registerAndVerify(page, bystander);
  await page.goto('/sign-in');
  await signIn(page, bystander);
  await page.waitForURL('**/create-organization');

  const token = await issueInvitation({ organizationId: organization.id, email: invited });
  await page.goto(`/invitation/${token}`);

  await expect(page.getByText('Invitația este pentru altă adresă')).toBeVisible();
  // Both addresses, in the sentence that explains the refusal — scoped to it, because the invited
  // one deliberately appears again on the control that offers the way out.
  const explanation = page.getByText(/Invitația a fost trimisă la/);
  await expect(explanation).toContainText(invited);
  await expect(explanation).toContainText(bystander);

  // The way out signs them out and comes back HERE, so the link survives the round trip.
  await page.getByRole('button', { name: new RegExp(`Ieșiți și autentificați-vă`) }).click();
  await page.waitForURL('**/sign-in**');
  expect(new URL(page.url()).searchParams.get('return')).toBe(`/invitation/${token}`);
});
