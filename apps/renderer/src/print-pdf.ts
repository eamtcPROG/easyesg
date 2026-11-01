import { chromium, type BrowserServer } from 'playwright';
import { renderSwitch } from './kill-render.js';

/** What the page-side reading of the links needs of an anchor. */
interface Anchor {
  getAttribute(name: string): string | null;
  readonly textContent: string | null;
}

/** What Chromium answers: the tagged PDF as printed, and each link's words in document order for the finisher. */
export interface PrintedPdf {
  readonly pdf: Buffer;
  /** Every `<a href>`'s accessible name, in the order the structure tree holds the links (PDF/UA-1 7.18.5). */
  readonly links: readonly string[];
}

/**
 * One render on a browser of its own (T-13): Chromium is launched for this document and killed when it is done, so a
 * render never inherits a browser another one left wedged, and a retry is on a fresh instance by construction of the
 * call, not by luck. `track` hands the launched server to the caller the moment it exists, which is what lets a
 * deadline kill a render that has stopped answering.
 *
 * The page reaches nothing: every request it would make is aborted — the document carries its styles and fonts inside
 * it (§12.5.6's task-43 row) and no script, so a request is never the document's and always something to refuse.
 */
export async function printPdf(input: {
  readonly markup: string;
  /** This render's id, carried on the browser's command line so `killRender` can find it before a handle exists. */
  readonly render: string;
  readonly track: (server: BrowserServer) => void;
}): Promise<PrintedPdf> {
  const server = await chromium.launchServer({ args: ['--disable-dev-shm-usage', renderSwitch(input.render)] });
  input.track(server);
  try {
    const browser = await chromium.connect(server.wsEndpoint());
    const page = await browser.newPage();
    await page.route('**/*', (route) => route.abort());
    await page.setContent(input.markup, { waitUntil: 'load' });
    // Runs in the page, where an anchor is a DOM element; typed by the two members it reads, as this Node workspace
    // carries no DOM library.
    const links = await page.$$eval('a[href]', (anchors: readonly Anchor[]) =>
      anchors.map((anchor) => (anchor.getAttribute('aria-label') ?? anchor.textContent ?? '').replace(/\s+/gu, ' ').trim()),
    );
    // `tagged` is what makes a structure tree at all — Chromium prints an untagged file by default (AD-10); `outline`
    // gives a reader the headings as bookmarks; the page size and margins are the document's own `@page` rules.
    const pdf = await page.pdf({ tagged: true, outline: true, preferCSSPageSize: true, printBackground: true });
    return { pdf, links };
  } finally {
    await server.kill();
  }
}
