import { expect, test } from '@playwright/test';
import { exactlyPadded } from './support/expansion';

/**
 * The +40% expansion harness on the new screens (UX-94; task 20's deliverable says it must
 * pass here). This project's server runs with `EASYESG_PSEUDOLOCALE=1`, so every catalogue
 * string arrives padded 40% — a layout that depends on string length fails here rather than in
 * a translated production build.
 *
 * "Passes" is operationalized as UX-18's actual obligation: every layout tolerates the
 * expansion — nothing forces a horizontal scroll at any of the three design frames (1440 /
 * 834 / 390, UX-73), and the screen's one primary action stays visible and usable.
 */
const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

/** Each screen's own heading, so the padding is proven on this screen's strings, not on any string. */
const SCREENS = [
  { path: '/register', heading: 'Creați-vă contul', action: 'Creați contul' },
  { path: '/verify', heading: 'Confirmați-vă adresa de e-mail', action: 'Trimiteți linkul' },
  // The help centre since task 77, drawn as its artboards since task 227: S-32's opening and search and S-34's form are
  // catalogue text, which the padding reaches; the articles themselves are the store's, which it does not, so S-33 has
  // nothing here to measure.
  { path: '/help', heading: 'Citiți totul înainte de a decide ceva', action: 'Căutați' },
  { path: '/help/contact', heading: 'Scrieți asistenței', action: 'Trimiteți asistenței' },
];

for (const screen of SCREENS) {
  for (const frame of FRAMES) {
    test(`${screen.path} tolerates +40% at ${frame.width}`, async ({ page }) => {
      await page.setViewportSize(frame);
      await page.goto(screen.path);

      // The padded catalogue actually arrived on this screen — otherwise this asserts nothing. A web-first
      // assertion rather than `isVisible()`, which answered once, without waiting for the page to settle.
      await expect(
        page.getByRole('heading', { level: 1, name: exactlyPadded(screen.heading) }),
      ).toBeVisible();

      // No horizontal overflow: the document is no wider than the viewport.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      // The primary action survived the expansion.
      const action = page.getByRole('button', { name: new RegExp(screen.action) });
      await expect(action).toBeVisible();
    });
  }
}
