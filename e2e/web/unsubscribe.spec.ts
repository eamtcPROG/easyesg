import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { cleanupRecipients, seedRecipient, switchedOffFor, unsubscribeTokenFor } from './support/unsubscribe';

/**
 * S-38 and RFC 8058's one-click target in a real browser (task 52.2.2; FR-169; `design_spec.md` S-38) — the
 * deliverable stated as a journey: **every optional-category email carries a working one-click unsubscribe.**
 *
 * `unsubscribe.spec.ts` in `apps/web` proves the branch arm by arm and the api's suites prove the switch; this proves
 * the wiring the reader actually meets — a signed-out reader opening the link, reading what it stops, and the press
 * reaching the table — and that the mail client's `POST` reaches it through `/mail`, outside the locale routing and
 * the proxy's session gate.
 */
const RUN_PREFIX = `task52-2-2-${process.pid}-${Date.now()}`;
const REMINDER = 'reporting.manual_reminder';
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.afterAll(async () => {
  await cleanupRecipients(RUN_PREFIX);
});

const recipient = async (label: string) => {
  const accountId = await seedRecipient(`${RUN_PREFIX}-${label}@example.md`);
  return { accountId, token: unsubscribeTokenFor({ accountId, categoryKey: REMINDER }) };
};

test('a signed-out reader unsubscribes from an email in one press, and the link says so afterwards', async ({ page }) => {
  const { accountId, token } = await recipient('page');

  await page.goto(`/unsubscribe/${token}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Dezabonare de la e-mailuri' })).toBeVisible();
  await expect(page.getByText('Nu veți mai primi prin e-mail mesajele din categoria „Mementouri”.')).toBeVisible();
  // Opening the page changed nothing: a scanner that prefetches the link stops here.
  expect(await switchedOffFor(accountId)).toEqual([]);
  const ready = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(ready.violations).toEqual([]);

  await page.getByRole('button', { name: 'Dezabonați-mă' }).click();

  await expect(page.getByText('V-ați dezabonat')).toBeVisible();
  expect(await switchedOffFor(accountId)).toEqual([{ category_key: REMINDER, channel: 'email' }]);

  await page.reload();
  await expect(page.getByText('Sunteți deja dezabonat')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dezabonați-mă' })).toHaveCount(0);
});

test('the page reads in the language of the link', async ({ page }) => {
  const { token } = await recipient('english');

  await page.goto(`/en/unsubscribe/${token}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Unsubscribe from emails' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unsubscribe' })).toBeVisible();
});

test('a link the platform did not sign switches nothing and says so', async ({ page }) => {
  const { accountId } = await recipient('forged');
  const forged = unsubscribeTokenFor({
    accountId,
    categoryKey: REMINDER,
    signingKey: 'a-key-this-platform-does-not-hold-0000000000',
  });

  await page.goto(`/unsubscribe/${forged}`);

  await expect(page.getByText('Linkul nu poate fi folosit')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dezabonați-mă' })).toHaveCount(0);
  expect(await switchedOffFor(accountId)).toEqual([]);
});

test('a mail client’s one-click POST switches it off, with no session and no language', async ({ request }) => {
  const { accountId, token } = await recipient('one-click');

  const answer = await request.post(`/mail/unsubscribe/${token}`, {
    form: { 'List-Unsubscribe': 'One-Click' },
    maxRedirects: 0,
  });

  expect(answer.status()).toBe(200);
  expect(await switchedOffFor(accountId)).toEqual([{ category_key: REMINDER, channel: 'email' }]);

  const forged = await request.post(`/mail/unsubscribe/not-a-token`, {
    form: { 'List-Unsubscribe': 'One-Click' },
    maxRedirects: 0,
  });
  expect(forged.status()).toBe(400);
});
