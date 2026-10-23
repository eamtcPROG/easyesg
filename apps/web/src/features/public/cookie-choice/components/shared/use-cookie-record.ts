import { useMemo, useSyncExternalStore } from 'react';
import { type CookieChoiceRecord, cookieChoiceValueIn, decodeCookieChoice } from '../../tools/cookie-choice-cookie';

/**
 * **In `components/shared/` because two of S-31's folders read it** — the island, which shows the banner until an
 * answer is held, and the cookie policy's standing line, which states it.
 *
 * The browser's answer to the cookie banner, read from `document.cookie` (task 223; §12.5.6's task-223 row (8)).
 *
 * **`known` is false on the server and through hydration**: the server cannot see a cookie the prerendered home never
 * read, so the first render shows no banner on either side and the client's own read follows — a banner appearing a
 * moment after the page, rather than a mismatch or a home that stops being prerendered.
 *
 * **Cookies raise no event**, so the store is told: `cookieChoiceChanged` after the Server Action's answer lands.
 */
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Tells every reader to look again — called once a recorded answer's cookie is in the jar. */
export const cookieChoiceChanged = (): void => {
  for (const listener of listeners) listener();
};

const UNKNOWN = null;

export function useCookieRecord(): { readonly known: boolean; readonly record: CookieChoiceRecord | null } {
  const value = useSyncExternalStore<string | null>(
    subscribe,
    () => cookieChoiceValueIn(document.cookie),
    () => UNKNOWN,
  );
  return useMemo(() => ({ known: value !== UNKNOWN, record: value === UNKNOWN ? null : decodeCookieChoice(value) }), [value]);
}
