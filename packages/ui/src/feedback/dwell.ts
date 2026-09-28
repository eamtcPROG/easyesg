/**
 * How long a confirmation has been readable — `ExpiringCallout`'s clock, and the only arithmetic in it.
 *
 * **The dwell counts only time the notice could have been read** (`design_spec.md` §8.1's Success row, amended
 * 28 Sep 2026 by the project owner). A Record's save button is at its foot and its notice at its head, so on a long
 * form the notice lands out of view; a plain eight-second timer would take it away before anyone had seen it. So the
 * clock stops whenever any reason below holds and resumes, with what it had left, when none does.
 *
 * **Pure, and out of the hook**, because pausing twice, resuming twice and a pause longer than what was left are
 * exactly the transitions a component test would have to contrive with fake timers and four kinds of event. Here each
 * is one line of a spec.
 */

/**
 * How long a confirmation stays once it could have been read — the Success row's eight seconds. Here rather than in
 * `expiring-callout.tsx` because that module is a client boundary, and a constant exported across one reaches a Server
 * Component as `undefined`.
 */
export const NOTICE_DWELL_MS = 8000;

export interface DwellClock {
  /** What is left of the dwell, as of the last pause. */
  readonly remainingMs: number;
  /** When the clock last started, or `null` while it is stopped. */
  readonly runningSince: number | null;
}

/**
 * Why the notice cannot be read, or is being read, right now. Any one of them stops the clock: a pointer or focus on
 * the notice means the reader is at it, and off screen or a hidden tab means they cannot be.
 */
export interface DwellHolds {
  readonly hovered: boolean;
  readonly focused: boolean;
  readonly offScreen: boolean;
  readonly documentHidden: boolean;
}

export const startDwell = (durationMs: number): DwellClock => ({ remainingMs: durationMs, runningSince: null });

export const isReadable = (holds: DwellHolds): boolean =>
  !holds.hovered && !holds.focused && !holds.offScreen && !holds.documentHidden;

/** Start the clock at `now`. A clock already running keeps the start it had, so a second resume loses nothing. */
export const resumeDwell = (clock: DwellClock, now: number): DwellClock =>
  clock.runningSince === null ? { remainingMs: clock.remainingMs, runningSince: now } : clock;

/** Stop the clock at `now`, keeping what is left. Never below zero: a late pause is a dwell that is already over. */
export const pauseDwell = (clock: DwellClock, now: number): DwellClock =>
  clock.runningSince === null
    ? clock
    : { remainingMs: Math.max(0, clock.remainingMs - (now - clock.runningSince)), runningSince: null };
