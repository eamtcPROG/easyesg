import { test as base, type Browser, type BrowserContext, type ConsoleMessage } from '@playwright/test';

export { expect } from '@playwright/test';
export type { Browser, BrowserContext, Locator, Page, Request } from '@playwright/test';

/**
 * Every browser journey's `test` (task 243): Playwright's, with one automatic fixture that **fails a test whose
 * browser reported an error** — an uncaught page error, or a console message at `error` — from any page of any context
 * the test opened.
 *
 * **Why it exists.** S-09 failed to hydrate on every load from task 39 until task 243, twice over — a `<nav>` inside a
 * `<p>` (fixed 19 Oct 2026, 1abb3821) and then the autosave reading Node's `navigator` as offline — while every journey
 * passed: React logged *Minified React error #418*, re-rendered the page on the client, and the assertions found the
 * client's render. The same run found the console's ended-session exit looping until React's update limit (#185),
 * under a journey that still landed where it expected. A boot that logs is not a boot that works (root `CLAUDE.md`), and
 * nothing in `e2e/` read the console until this file.
 *
 * **What it lets through is four lines Chromium writes itself, each a refusal a journey provokes on purpose and
 * none of them the page's code.** Measured on the full suite before the gate turned on (`docs/build-log.md`, task 243):
 * every other line it recorded was one of the two defects above. A new kind here is a decision, with its reason —
 * never a pattern widened until a red journey goes quiet. A 5xx is deliberately not among them.
 *
 * **Every context, not only the fixture's.** Ten specs open a second browser with `browser.newContext()`; it is
 * listened to for the length of the test by wrapping that one method, and unwrapped after.
 */
interface BrowserReport {
  readonly source: 'pageerror' | 'console';
  readonly url: string;
  readonly text: string;
}

const EXPECTED_BROWSER_LINES: readonly RegExp[] = [
  // Chromium logs every 4xx a page's request answers. Journeys ask on purpose: a session probe signed out (401), a
  // privilege a role lacks (403), an address that does not exist (404), a registration already taken (409).
  /^Failed to load resource: the server responded with a status of 4\d\d \(/,
  // `context.setOffline(true)` — the offline journeys' queue — fails every request the page makes meanwhile, and
  // AD-15's socket if it happens to reconnect inside the window (one full run in two, measured).
  /^Failed to load resource: net::ERR_INTERNET_DISCONNECTED$/,
  /^WebSocket connection to '[^']+' failed: Error in connection establishment: net::ERR_INTERNET_DISCONNECTED$/,
  // AD-15's socket presenting a ticket after the session it was minted for ended elsewhere: the api refuses the
  // upgrade with 401, which is the session-ended journey's premise.
  /^WebSocket connection to '[^']+' failed: HTTP Authentication failed; no valid credentials available$/,
];

/** React's production codes for a hydration failure, and the development build's sentence. */
const HYDRATION = /Minified React error #(418|419|423|425)\b|Hydration failed/;

const isExpected = (report: BrowserReport): boolean =>
  report.source === 'console' && EXPECTED_BROWSER_LINES.some((pattern) => pattern.test(report.text));

const describe = (report: BrowserReport): string =>
  `${HYDRATION.test(report.text) ? 'the page failed to hydrate' : report.source} at ${report.url}\n    ${report.text}`;

function listen(context: BrowserContext, into: BrowserReport[]): void {
  context.on('weberror', (error) =>
    into.push({ source: 'pageerror', url: error.page()?.url() ?? '', text: String(error.error()) }),
  );
  context.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') return;
    into.push({ source: 'console', url: message.page()?.url() ?? '', text: message.text() });
  });
}

function listenToNewContexts(browser: Browser, into: BrowserReport[]): () => void {
  const original = browser.newContext.bind(browser);
  browser.newContext = async (...args: Parameters<Browser['newContext']>) => {
    const context = await original(...args);
    listen(context, into);
    return context;
  };
  return () => {
    browser.newContext = original;
  };
}

export const test = base.extend<{ browserErrors: void }>({
  browserErrors: [
    async ({ context, browser }, use) => {
      const reports: BrowserReport[] = [];
      listen(context, reports);
      const restore = listenToNewContexts(browser, reports);
      try {
        await use();
      } finally {
        restore();
      }
      const unexpected = reports.filter((report) => !isExpected(report));
      if (unexpected.length > 0) {
        const hydration = unexpected.some((report) => HYDRATION.test(report.text));
        throw new Error(
          `${hydration ? 'A page failed to hydrate' : 'The browser reported an error'} during this journey ` +
            `(${unexpected.length} line${unexpected.length === 1 ? '' : 's'}):\n  ${unexpected.map(describe).join('\n  ')}`,
        );
      }
    },
    { auto: true },
  ],
});
