import { useEffect, useEffectEvent, type RefObject } from 'react';
import { isReadable, pauseDwell, resumeDwell, startDwell, type DwellClock, type DwellHolds } from './dwell';

/** At least half of the notice in view counts as on screen; a sliver at the edge of a scroll region does not. */
const ON_SCREEN_RATIO = 0.5;

/** `apps/web`'s `tab-visibility.ts` asks the same question; this package cannot import an app, so it asks it here. */
const VISIBILITY = {
  VISIBLE: 'visible',
} as const satisfies Record<string, DocumentVisibilityState>;

const tabIsHidden = (): boolean => document.visibilityState !== VISIBILITY.VISIBLE;

/**
 * Calls `onElapsed` once the element has been readable for `durationMs` in total — `ExpiringCallout`'s timer.
 *
 * **Imperative, inside one effect, and holding no React state.** What stops the clock — a pointer, focus, the element
 * leaving the viewport, the tab going hidden — changes on events nothing renders from, so each is a field of a local
 * `holds` object and a change re-schedules a timeout rather than re-rendering the notice. The arithmetic is
 * `dwell.ts`'s, with its spec.
 *
 * **Off screen until the observer first reports**, so a notice mounted below the fold does not start counting before
 * anything knows where it is. Where there is no `IntersectionObserver` at all it counts as on screen: a notice that
 * never left would be worse than one that left early.
 *
 * `onElapsed` is read when the dwell runs out, never at mount, so the caller need not keep it stable.
 */
export function useDwell(input: {
  readonly target: RefObject<HTMLElement | null>;
  readonly durationMs: number;
  readonly onElapsed: () => void;
}): void {
  const { target, durationMs } = input;
  const elapse = useEffectEvent(input.onElapsed);

  useEffect(() => {
    const element = target.current;
    if (element === null) return;

    const observes = typeof IntersectionObserver !== 'undefined';
    const holds: { -readonly [K in keyof DwellHolds]: DwellHolds[K] } = {
      hovered: false,
      focused: false,
      offScreen: observes,
      documentHidden: tabIsHidden(),
    };
    let clock: DwellClock = startDwell(durationMs);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const sync = () => {
      const now = Date.now();
      if (isReadable(holds) && clock.runningSince === null) {
        clock = resumeDwell(clock, now);
        timer = setTimeout(() => elapse(), clock.remainingMs);
      } else if (!isReadable(holds) && clock.runningSince !== null) {
        clearTimeout(timer);
        clock = pauseDwell(clock, now);
      }
    };
    const hold = (reason: keyof DwellHolds, held: boolean) => {
      holds[reason] = held;
      sync();
    };

    const onPointerEnter = () => hold('hovered', true);
    const onPointerLeave = () => hold('hovered', false);
    const onFocusIn = () => hold('focused', true);
    // Focus moving between the notice's own controls is still focus on the notice.
    const onFocusOut = (event: FocusEvent) =>
      hold('focused', event.relatedTarget instanceof Node && element.contains(event.relatedTarget));
    const onVisibility = () => hold('documentHidden', tabIsHidden());

    element.addEventListener('pointerenter', onPointerEnter);
    element.addEventListener('pointerleave', onPointerLeave);
    element.addEventListener('focusin', onFocusIn);
    element.addEventListener('focusout', onFocusOut);
    document.addEventListener('visibilitychange', onVisibility);
    const observer = observes
      ? new IntersectionObserver(
          ([entry]) => hold('offScreen', entry === undefined || entry.intersectionRatio < ON_SCREEN_RATIO),
          { threshold: [0, ON_SCREEN_RATIO] },
        )
      : null;
    observer?.observe(element);
    sync();

    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      element.removeEventListener('pointerenter', onPointerEnter);
      element.removeEventListener('pointerleave', onPointerLeave);
      element.removeEventListener('focusin', onFocusIn);
      element.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [target, durationMs]);
}
