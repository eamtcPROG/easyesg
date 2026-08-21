import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The automated half of NFR-75's verification (architecture.md §12.1 pins @axe-core/playwright
 * for exactly this), on the first real screens. WCAG 2.2 AA is the target; axe automates the
 * machine-checkable part and the manual keyboard/screen-reader audit remains the other half.
 *
 * All three locales on the register screen: the axe pass is mostly locale-independent, but
 * `lang` correctness and accessible names are precisely what varies.
 */
const SCREENS = ['/register', '/en/register', '/ru/register', '/verify'];

for (const screen of SCREENS) {
  test(`axe finds no violations on ${screen}`, async ({ page }) => {
    await page.goto(screen);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}
