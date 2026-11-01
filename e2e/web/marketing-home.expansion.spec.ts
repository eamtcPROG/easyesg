import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { exactlyPadded, overflowWithin } from './support/expansion';

/**
 * S-29 at +40% (UX-94; task 74.3, FR-204's AC-6), at UX-73's three frames.
 *
 * **The home is the page in the product made most of sentences** — a hero, eleven sections each with its sentence, six
 * questions answered, two pictures of the wizard — so it is where a padded catalogue finds a layout that only fitted
 * its own words. The padded text is checked to have arrived before anything is measured, or this asserts nothing; and
 * the figures are measured on their own as well as the page, since a picture clipped by its frame would not widen the
 * document and would still be broken.
 *
 * **Rendered through draft mode, from the same bundle** (task 74.4). The padded catalogue is a runtime switch on the
 * expansion server, and the home is prerendered at build time, so that server's cache holds the home in plain
 * Romanian. Next's own draft mode — the `__prerender_bypass` cookie, valued at the bundle's preview id — makes it render
 * the page per request instead, with the catalogue the server was started with. No second build and no code in the
 * app: the padded heading below is what proves the render was a fresh one.
 */
const { previewModeId } = (
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../apps/web/.next/standalone/apps/web/.next/prerender-manifest.json', import.meta.url)),
      'utf8',
    ),
  ) as { preview: { previewModeId: string } }
).preview;

const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
] as const;

const HEADING = 'Raportul de durabilitate îl puteți întocmi chiar dumneavoastră.';
const START = 'Începeți raportul';

for (const frame of FRAMES) {
  test(`/ tolerates +40% at ${frame.width}`, async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: '__prerender_bypass', value: previewModeId, url: baseURL }]);
    await page.setViewportSize(frame);
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: exactlyPadded(HEADING) })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // The question in each picture, which a frame with `overflow: hidden` would cut without widening the page.
    for (const question of await page.getByRole('main').locator('figure [role="group"]').all()) {
      expect(await overflowWithin(question)).toBeLessThanOrEqual(0);
    }

    await expect(page.getByRole('main').getByRole('link', { name: new RegExp(START) })).toBeVisible();
  });
}
