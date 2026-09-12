import { expect, test } from '@playwright/test';

/**
 * Task 96's deliverable, literally: **no form can submit its fields into a URL**, proven with
 * scripting disabled.
 *
 * The exposure was never a broken build. Every form in both front ends is `<form onSubmit={…}>`,
 * and the handler exists only once React has hydrated — but the markup is interactive before that,
 * so Enter on a field submits with the browser's own default: a GET to the current URL with every
 * field in the query string. Observed while diagnosing task 36.2's browser run, as
 * `/register?email=…&password=Parola123%21`. A password in a URL reaches the access log, the
 * browser history and the `Referer` of whatever loads next, which is what NFR-30 forbids of
 * personal data in the first place.
 *
 * **Scripting off is the honest reproduction, not a contrivance.** It is the same window a fast
 * typist opens, held open — the realistic trigger is Enter before hydration, and a chunk that 404s
 * or JS switched off are that same failure with a longer window. `eslint:prove`'s `form-method`
 * selector is what keeps a new form from regressing it; this file is what proves the selector's
 * subject is real, by driving the thing a person actually does.
 *
 * **What is asserted is the absence of a query string, not a successful submit.** `method="post"`
 * moves the fields into a request body and leaves the submit unhandled — the page has no route
 * handler for a POST, so the browser gets a 405. That is the remedy working: a 405 is a visible
 * failure a person can report, where a leaked credential is an invisible one nobody sees. Making
 * these flows *work* without JS is progressive enhancement and is task 153's, not this file's.
 */
const PASSWORD = 'Parola123!';
const EMAIL = 'e2e-form-method@example.md';

/** The credential-carrying screens reachable without a session. The remaining three of task 96's
 *  eight sit behind one (S-28's password section and factor body) or inside the admin realm, and
 *  are covered by the `form-method` selector rather than by a journey — reaching them needs a
 *  sign-in, which needs the scripting this suite has switched off. */
interface Screen {
  readonly what: string;
  readonly path: string;
  readonly submit: RegExp;
  readonly fields: Readonly<Record<string, string>>;
}

const SCREENS: readonly Screen[] = [
  { what: 'S-01 sign in', path: '/sign-in', submit: /Intrați în cont/i, fields: { email: EMAIL, password: PASSWORD } },
  { what: 'S-01 register', path: '/register', submit: /Creați contul/i, fields: { email: EMAIL, password: PASSWORD } },
  { what: 'S-02 request a reset', path: '/reset', submit: /Trimiteți/i, fields: { email: EMAIL } },
];

test.describe('a submit that beats hydration cannot put fields in the URL (task 96, NFR-30)', () => {
  test.use({ javaScriptEnabled: false });

  for (const screen of SCREENS) {
    test(`${screen.what} submits nothing into the query string`, async ({ page }) => {
      await page.goto(screen.path);

      // The form is present as markup with no JavaScript at all — which is precisely why the
      // browser default was reachable.
      await expect(page.locator('form').first()).toBeVisible();

      for (const [type, value] of Object.entries(screen.fields)) {
        await page.locator(`input[type="${type}"]`).first().fill(value);
      }

      // **The REQUEST is what is asserted, not the address bar**, and two earlier versions of this
      // file are why. The first called `form.evaluate(el => el.submit())` — with
      // `javaScriptEnabled: false` Playwright cannot evaluate in the page, so nothing submitted and
      // the URL assertions passed with the fix REVERTED. The second clicked and waited for the URL
      // to change, which never happens: a POST to the same path leaves the address bar identical,
      // which is the remedy working. Observing the outgoing request settles both — it proves a
      // submit occurred, proves which verb it used, and reads the fields' actual destination.
      const [request] = await Promise.all([
        page.waitForRequest((r) => r.url().includes(screen.path), { timeout: 10_000 }),
        page.getByRole('button', { name: screen.submit }).click(),
      ]);

      const url = new URL(request.url());
      expect(url.search, `${screen.what}: fields reached the URL as ${url.search}`).toBe('');
      expect(decodeURIComponent(request.url())).not.toContain(PASSWORD);
      // The verb is the mechanism behind the two lines above rather than a substitute for them.
      expect(request.method(), `${screen.what} submitted as ${request.method()}`).toBe('POST');
    });
  }
});
