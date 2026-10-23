/**
 * **In `components/shared/` because three of S-31's folders read it** — the island that opens the settings, and the
 * footer's button and the cookie policy's standing line that ask it to.
 *
 * How a part anywhere on a page opens S-31's settings (task 223): it asks, and the island — mounted once, beside the
 * page — opens them. **A signal rather than a React context, and that is the fix for a defect, not a preference**: the
 * island as a provider around the page changed its value as hydration ended, and a context change reaching a Suspense
 * boundary still streaming makes React abandon that boundary's server HTML and render it again on the client — for a
 * moment the page was on screen twice, and a locator expecting one element found two. Beside the page, the island's
 * own updates reach nothing of it.
 *
 * Module state, and only the browser's: an opener is registered from an effect, which never runs on the server.
 */
const openers = new Set<() => void>();

/** The island's registration — answers the way to withdraw it, as an effect's cleanup wants. */
export function onCookieSettingsRequested(open: () => void): () => void {
  openers.add(open);
  return () => {
    openers.delete(open);
  };
}

/** Asks for S-31's settings over the page the reader is on. */
export function requestCookieSettings(): void {
  for (const open of openers) open();
}
