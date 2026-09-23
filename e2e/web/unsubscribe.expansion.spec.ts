import { expect, test } from '@playwright/test';
import { exactlyPadded } from './support/expansion';
import { cleanupRecipients, seedRecipient, unsubscribeTokenFor } from './support/unsubscribe';

/**
 * S-38 at +40% (task 52.2.2; UX-94, UX-73's three frames) — the ready arm, its one sentence and its one action, which
 * is the arm a reader meets. The category's name is the api's word and arrives padded too, from the padded api the
 * browser suite runs beside this server (task 51.3). In the `expansion` project for `credentials.expansion.spec.ts`'s
 * recorded reason: only that server runs with `EASYESG_PSEUDOLOCALE=1`.
 */
const RUN_PREFIX = `task52-2-2-x-${process.pid}-${Date.now()}`;

test.afterAll(async () => {
  await cleanupRecipients(RUN_PREFIX);
});

const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

for (const frame of FRAMES) {
  test(`S-38 holds its padded copy at ${frame.width}px`, async ({ page }) => {
    const accountId = await seedRecipient(`${RUN_PREFIX}-${frame.width}@example.md`);
    await page.setViewportSize(frame);

    await page.goto(`/unsubscribe/${unsubscribeTokenFor({ accountId, categoryKey: 'reporting.manual_reminder' })}`);

    await expect(page.getByRole('heading', { level: 1, name: exactlyPadded('Dezabonare de la e-mailuri') })).toBeVisible();
    await expect(page.getByRole('button', { name: exactlyPadded('Dezabonați-mă') })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
