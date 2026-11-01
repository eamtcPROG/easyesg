import { useSyncExternalStore } from 'react';
import { useTranslations } from 'use-intl';
import { minutesLeft } from '../../tools/countdown';

/** Re-read every quarter minute: often enough that the whole minute shown is never more than 15 seconds stale. */
const COUNTDOWN_TICK_MS = 15 * 1000;

/**
 * The reader's clock, re-read every tick — through `useSyncExternalStore`, React's own shape for a value that
 * changes outside React: the tick is the subscription and the clock a snapshot, rather than state set by an effect.
 * The snapshot is rounded to the tick so two reads inside one render agree. Private to the countdown, its one reader.
 */
function useNow(everyMs: number): number {
  return useSyncExternalStore(
    (onTick) => {
      const timer = window.setInterval(onTick, everyMs);
      return () => window.clearInterval(timer);
    },
    () => Math.floor(Date.now() / everyMs) * everyMs,
  );
}

/**
 * UX-124's *own expiry countdown* (task 67.9) — whole minutes left on a running grant, ticking as often as the
 * minute it shows can change (UX-116). A `timer` role, which assistive technology does not announce on every
 * change, since a count read aloud each quarter minute would talk over the reading it is beside.
 *
 * **In `components/shared/` on its two readers**: `in-progress/`'s list item and `grant/`'s heading.
 */
export function GrantCountdown({ expiresAt }: { readonly expiresAt: number }) {
  const t = useTranslations('platform.supportAccess.inProgress');
  const now = useNow(COUNTDOWN_TICK_MS);

  return <span role="timer">{t('minutesLeft', { minutes: minutesLeft({ expiresAt, now }) })}</span>;
}
