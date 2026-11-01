import { expect, test } from '@playwright/test';

/**
 * The console with scripting off (task 153; §12.5.6's task-153 row, NFR-81). A static SPA renders nothing until its
 * script runs, so it has no credential form before its handler exists — task 96's exposure never reached it — and what
 * a browser with scripting off would otherwise get is a blank page: a silent failure. `index.html`'s `<noscript>` is
 * the explicit one, and this is what holds it there.
 */
test.describe('the console says it needs JavaScript rather than showing nothing', () => {
  test.use({ javaScriptEnabled: false });

  test('a browser with scripting off is told why the console cannot be shown, and what to do', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByText(/Consola de administrare are nevoie de JavaScript/u)).toBeVisible();
    await expect(page.getByText(/Activați JavaScript în setările browserului, apoi reîncărcați pagina\./u)).toBeVisible();
    // And nothing to type a credential into: the form exists only once the script has run.
    await expect(page.locator('input')).toHaveCount(0);
  });
});
