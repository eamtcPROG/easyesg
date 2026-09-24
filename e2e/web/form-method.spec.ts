import { expect, test, type Browser, type Locator, type Page, type Request } from '@playwright/test';
import { cleanupAccounts, verificationTokenFor } from './support/db';

/**
 * A credential form **fails explicitly without scripting** — task 153's deliverable (§12.5.6's task-153 row; NFR-81,
 * NFR-79, NFR-30), over task 96's, which it keeps.
 *
 * Task 96 found every form's handler existing only once React had hydrated, while its markup was interactive before
 * that, so Enter submitted with the browser's default: a GET with every field in the URL. `method="post"` stopped the
 * leak and left a 405. **Task 153 closes the rest**: each credential form keeps its submit disabled until the page
 * has hydrated, so a press before then submits nothing — no request, no 405 — and, with scripting off, says why in a
 * notice inside `<noscript>`. Working without scripting was the alternative; no requirement asks for it, and the row
 * records what would change that.
 *
 * **Scripting off is the honest reproduction, not a contrivance.** It is the window a fast typist opens, held open —
 * the realistic trigger is Enter before hydration, and a chunk that fails to load or scripting switched off are that
 * same failure with a longer window.
 *
 * **Which forms, and which this file drives.** Seven forms exist as markup before hydration: S-01's sign-in and its
 * factor step, S-01's registration, S-02's reset request and new password, S-36's first password and S-28's password
 * section. This file drives four — the three a signed-out visitor reaches, and S-28's, by carrying a session signed in
 * with scripting on into a browser with it off; S-28 and S-36 sit behind a route-level `loading.tsx`, so theirs is the
 * fallback's notice (the S-28 case says why). The other three sit behind a sign-in challenge, a reset link or a setup
 * state, and share one component with the four (`shared/credential-submit.tsx`, whose spec pins the disabled HTML);
 * the `form-method` selector keeps any of them from losing `method="post"`. The re-authentication dialogue and S-28's
 * second-factor form appear only after scripting runs and are not on the list. **The console** is a static SPA that
 * renders nothing without its script, so it has no such window — its `index.html` says so in a `<noscript>` of its own.
 */
const RUN_PREFIX = `e2e-web-form-method-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';
const EMAIL = `${RUN_PREFIX}@example.md`;

test.afterAll(async () => {
  await cleanupAccounts(RUN_PREFIX);
});

/** The notice's title, as `forms.scriptingRequired.title` reads in Romanian. */
const NOTICE = 'Această pagină are nevoie de JavaScript';

interface Screen {
  readonly what: string;
  readonly path: string;
  readonly submit: RegExp;
  readonly fields: readonly { readonly label: string; readonly value: string }[];
}

const SIGNED_OUT: readonly Screen[] = [
  {
    what: 'S-01 sign in',
    path: '/sign-in',
    submit: /Intrați în cont/i,
    fields: [
      { label: 'Adresa de e-mail', value: EMAIL },
      { label: 'Parolă', value: PASSWORD },
    ],
  },
  {
    what: 'S-01 register',
    path: '/register',
    submit: /Creați contul/i,
    fields: [
      { label: 'E-mail de serviciu', value: EMAIL },
      { label: 'Parolă', value: PASSWORD },
    ],
  },
  { what: 'S-02 request a reset', path: '/reset', submit: /Trimiteți/i, fields: [{ label: 'Adresa de e-mail', value: EMAIL }] },
];

/**
 * Fills a screen's fields, presses Enter in the last — what a person does before a page has hydrated — and answers
 * every request the page made to its own address meanwhile. **The requests are what is asserted**, not the address
 * bar, and task 96's two vacuous versions of this file are why: a submit that never happened and a POST to the same
 * path both leave the address unchanged.
 */
async function pressEnterIn(page: Page, screen: Screen, within: Locator | Page): Promise<Request[]> {
  const sent: Request[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith(screen.path)) sent.push(request);
  });
  for (const field of screen.fields) {
    await within.getByLabel(field.label, { exact: true }).fill(field.value);
  }
  await within.getByLabel(screen.fields[screen.fields.length - 1].label, { exact: true }).press('Enter');
  // Long enough for a submit to leave; a request that was going to be sent is sent at once.
  await page.waitForTimeout(1_500);
  return sent;
}

async function expectExplicitFailure(input: {
  readonly page: Page;
  readonly screen: Screen;
  readonly within?: Locator;
}): Promise<void> {
  const { page, screen } = input;
  const within = input.within ?? page;
  // The failure is explicit: the form carries the notice — what happened, and what to do — inside `<noscript>`.
  // **Read as the form's markup, not by text**, because text did not work and the reason is not known. Measured:
  // `getByText` finds nothing inside this `<noscript>` under `javaScriptEnabled: false` and under a browser launched
  // with scripting off in its own settings alike — while that browser draws the notice above the form (screenshot,
  // task 153's build-log), and while the console's `<noscript>`, directly in `<body>`, IS found by text. The markup is
  // what ships and what a browser with scripting off draws, so the markup is what is asserted.
  const notice = (await within.locator('form noscript').first().innerHTML()).replaceAll('&nbsp;', ' ');
  expect(notice, `${screen.what}: the notice's title`).toContain(NOTICE);
  expect(notice, `${screen.what}: the notice's way out`).toContain(
    'Activați JavaScript în setările browserului, apoi reîncărcați pagina.',
  );
  // The mechanism: the default button is disabled, so the browser does not submit the form on Enter.
  await expect(within.getByRole('button', { name: screen.submit })).toBeDisabled();

  const sent = await pressEnterIn(page, screen, within);
  expect(sent.map((request) => `${request.method()} ${request.url()}`), `${screen.what} sent a request`).toEqual([]);
}

test.describe('a credential form fails explicitly without scripting (task 153, NFR-81)', () => {
  test.use({ javaScriptEnabled: false });

  for (const screen of SIGNED_OUT) {
    test(`${screen.what} says it needs JavaScript and sends nothing`, async ({ page }) => {
      await page.goto(screen.path);
      await expectExplicitFailure({ page, screen });
    });
  }

  /**
   * **S-28 sits behind a route-level `loading.tsx`** (task 137), and with scripting off what arrives depends on time:
   * a section that answers before the page is flushed is sent inline, form and all; one that does not is sent as the
   * fallback, with the page streamed into hidden markup only a script swaps in. **Both are explicit failures**, which
   * is what this asserts: a notice outside hidden markup — the form's or the fallback's — and a submit that is
   * disabled either way. That the fallback carries the notice is `src/test/credential-loading-notice.spec.ts`'s to hold, since no
   * run here can choose which of the two it gets.
   */
  test('S-28 says it needs JavaScript, and its form cannot be sent', async ({ page, browser }) => {
    await page.context().addCookies(await signedInCookies(browser));
    await page.goto('/account/credentials');

    const shown = await page
      .locator('noscript')
      .evaluateAll((elements) => elements.filter((element) => element.closest('[hidden]') === null).map((e) => e.innerHTML));
    expect(shown.some((notice) => notice.includes(NOTICE)), 'S-28: the notice where a reader without scripting is').toBe(true);
    await expect(page.getByRole('button', { name: /Schimbați parola/i, includeHidden: true })).toBeDisabled();
  });
});

/** A session, signed in where scripting runs — the only way to get one — and handed to a browser where it does not. */
async function signedInCookies(browser: Browser) {
  const context = await browser.newContext({ ...test.info().project.use, javaScriptEnabled: true });
  const page = await context.newPage();
  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(EMAIL);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(EMAIL)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  await expect(page.getByText('Adresa este confirmată')).toBeVisible();
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(EMAIL);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  // A member of nothing lands on S-04, which is a session all the same.
  await page.waitForURL('**/create-organization');
  const cookies = await context.cookies();
  await context.close();
  return cookies;
}
