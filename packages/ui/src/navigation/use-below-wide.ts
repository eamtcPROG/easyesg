import { useSyncExternalStore } from 'react';

/**
 * Whether the frame is below `wide` — §3.3's one stated threshold, 64rem — the boundary the console sidebar changes
 * what its control does on (25 Oct 2026): at `wide` it folds the sidebar to its icon strip, below it the strip is the
 * resting state and the control lays the full sidebar over the page. CSS draws the two states; only this choice of
 * control needs the frame in script.
 *
 * A frame with no `matchMedia` — a test's DOM — reads as `wide`, the console's design target.
 */
const BELOW_WIDE = '(max-width: 63.9375rem)';

const query = () =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? null : window.matchMedia(BELOW_WIDE);

const subscribe = (onChange: () => void) => {
  const list = query();
  list?.addEventListener('change', onChange);
  return () => list?.removeEventListener('change', onChange);
};

const read = () => query()?.matches ?? false;

export function useBelowWide(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
