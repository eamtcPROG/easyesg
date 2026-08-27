import { expect, test } from '@playwright/test';

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

const SCREENS = [
  { path: '/register', action: 'Creați contul' },
  { path: '/verify', action: 'Trimiteți linkul' },
];

for (const screen of SCREENS) {
  for (const frame of FRAMES) {
    test(`${screen.path} tolerates +40% at ${frame.width}`, async ({ page }) => {
      await page.setViewportSize(frame);
      await page.goto(screen.path);

      // The padded catalogue actually arrived — otherwise this asserts nothing.
      const padded = await page.getByText('·').first().isVisible();
      expect(padded).toBe(true);

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
